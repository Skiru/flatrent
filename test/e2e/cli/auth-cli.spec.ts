import { exec } from 'child_process';
import * as path from 'path';
import { authDataSource } from '../../../src/auth/infrastructure/persistence/auth-data-source';
import { UserAccountEntity } from '../../../src/auth/infrastructure/persistence/user-account.entity';
import { RefreshSessionEntity } from '../../../src/auth/infrastructure/persistence/refresh-session.entity';
import * as crypto from 'crypto';

const cliPath = path.resolve(__dirname, '../../../dist/src/cli-entry.js');

function runCli(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    exec(`node "${cliPath}" ${args.join(' ')}`, (error, stdout, stderr) => {
      resolve({
        code: error ? error.code || 1 : 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      });
    });
  });
}

describe('Auth Bounded Context CLI E2E Tests', () => {
  beforeAll(async () => {
    if (!authDataSource.isInitialized) {
      await authDataSource.initialize();
    }
  });

  afterAll(async () => {
    if (authDataSource.isInitialized) {
      await authDataSource.destroy();
    }
  });

  beforeEach(async () => {
    await authDataSource.query('TRUNCATE TABLE user_accounts CASCADE');
    await authDataSource.query('TRUNCATE TABLE refresh_sessions CASCADE');
  });

  it('should create, inspect, and revoke user sessions via compiled CLI process', async () => {
    const userId = crypto.randomUUID();
    const email = 'cli.user@flatren.com';
    const password = 'SecurePassword123';
    const role = 'LANDLORD';

    // 1. CREATE USER
    const createRes = await runCli(['auth:create-user', userId, email, password, role]);
    expect(createRes.code).toBe(0);

    const parsedCreate = JSON.parse(createRes.stdout);
    expect(parsedCreate.status).toBe('SUCCESS');
    expect(parsedCreate.result.id).toBe(userId);

    // Verify DB state
    const dbUser = await authDataSource.getRepository(UserAccountEntity).findOneBy({ id: userId });
    expect(dbUser).toBeDefined();
    expect(dbUser!.email).toBe(email);

    // 2. INSPECT USER
    const inspectRes = await runCli(['auth:inspect-user', userId]);
    expect(inspectRes.code).toBe(0);

    const parsedInspect = JSON.parse(inspectRes.stdout);
    expect(parsedInspect.status).toBe('SUCCESS');
    expect(parsedInspect.result.id).toBe(userId);
    expect(parsedInspect.result.email).toBe(email);
    expect(parsedInspect.result.role).toBe(role);

    // 3. REVOKE USER SESSIONS
    // Create dummy active refresh session
    const sessionId = crypto.randomUUID();
    const sessionRepo = authDataSource.getRepository(RefreshSessionEntity);
    await sessionRepo.save({
      id: sessionId,
      userId,
      tokenHash: 'dummy-hash',
      expiresAt: new Date(Date.now() + 3600000),
      isRevoked: false,
    });

    const revokeRes = await runCli(['auth:revoke-user-sessions', userId]);
    expect(revokeRes.code).toBe(0);

    const parsedRevoke = JSON.parse(revokeRes.stdout);
    expect(parsedRevoke.status).toBe('SUCCESS');
    expect(parsedRevoke.userId).toBe(userId);

    // Verify session revoked in DB
    const dbSession = await sessionRepo.findOneBy({ id: sessionId });
    expect(dbSession!.isRevoked).toBe(true);
  });

  it('should return non-zero exit code and error JSON on failed command validations', async () => {
    // Missing arguments
    const res = await runCli(['auth:create-user', 'only-id']);
    expect(res.code).toBe(1);
    expect(res.stderr).toContain('Usage: auth:create-user');

    // Unknown command
    const unknownRes = await runCli(['auth:unknown-command-xyz']);
    expect(unknownRes.code).toBe(1);
    expect(unknownRes.stderr).toContain('Unknown command:');
  });
});
