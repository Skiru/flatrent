import { RegisterUserUseCase } from './commands/register-user/register-user.use-case';
import { RegisterUserCommand } from './commands/register-user/register-user.command';
import { LoginUseCase } from './commands/login/login.use-case';
import { LoginCommand, InvalidCredentialsError } from './commands/login/login.command';
import { RefreshTokenUseCase } from './commands/refresh-token/refresh-token.use-case';
import { RefreshTokenCommand } from './commands/refresh-token/refresh-token.command';
import { LogoutUseCase } from './commands/logout/logout.use-case';
import { LogoutCommand } from './commands/logout/logout.command';
import { ChangePasswordUseCase } from './commands/change-password/change-password.use-case';
import { ChangePasswordCommand } from './commands/change-password/change-password.command';
import { RevokeSessionsUseCase } from './commands/revoke-sessions/revoke-sessions.use-case';
import { RevokeSessionsCommand } from './commands/revoke-sessions/revoke-sessions.command';
import { GetCurrentActorUseCase } from './queries/get-current-actor/get-current-actor.use-case';
import { GetCurrentActorQuery } from './queries/get-current-actor/get-current-actor.query';
import { UserRole } from '../domain/model/user-account.aggregate';
import { RefreshSessionTokenReuseDetectedError } from '../domain/model/refresh-session.entity';
import {
  MockUserAccountRepository,
  MockRefreshSessionRepository,
  MockPasswordHasher,
  MockIdGenerator,
  MockClock,
} from '../../shared/application/test-utils';

describe('Auth Context Application Use Cases', () => {
  let userRepo: MockUserAccountRepository;
  let sessionRepo: MockRefreshSessionRepository;
  let passwordHasher: MockPasswordHasher;
  let idGen: MockIdGenerator;
  let clock: MockClock;

  let registerUseCase: RegisterUserUseCase;
  let loginUseCase: LoginUseCase;
  let refreshUseCase: RefreshTokenUseCase;
  let logoutUseCase: LogoutUseCase;
  let changePasswordUseCase: ChangePasswordUseCase;
  let revokeSessionsUseCase: RevokeSessionsUseCase;
  let getCurrentActorUseCase: GetCurrentActorUseCase;

  beforeEach(() => {
    userRepo = new MockUserAccountRepository();
    sessionRepo = new MockRefreshSessionRepository();
    passwordHasher = new MockPasswordHasher();
    idGen = new MockIdGenerator();
    clock = new MockClock();

    registerUseCase = new RegisterUserUseCase(userRepo, passwordHasher, idGen, clock);
    loginUseCase = new LoginUseCase(userRepo, sessionRepo, passwordHasher, idGen, clock);
    refreshUseCase = new RefreshTokenUseCase(sessionRepo, userRepo, passwordHasher, idGen, clock);
    logoutUseCase = new LogoutUseCase(sessionRepo);
    changePasswordUseCase = new ChangePasswordUseCase(userRepo, passwordHasher, idGen, clock);
    revokeSessionsUseCase = new RevokeSessionsUseCase(sessionRepo);
    getCurrentActorUseCase = new GetCurrentActorUseCase(userRepo);
  });

  it('should successfully register, login, refresh, and logout a user', async () => {
    // 1. REGISTER
    const regRes = await registerUseCase.execute(
      new RegisterUserCommand(
        'user-1',
        'landlord@test.com',
        'SecurePassword123',
        UserRole.LANDLORD,
      ),
    );
    expect(regRes.id).toBe('user-1');
    expect(regRes.email).toBe('landlord@test.com');

    // 2. LOGIN
    const loginRes = await loginUseCase.execute(
      new LoginCommand('landlord@test.com', 'SecurePassword123'),
    );
    expect(loginRes.userId).toBe('user-1');
    expect(loginRes.role).toBe(UserRole.LANDLORD);
    expect(loginRes.refreshToken).toBeDefined();

    // 3. REFRESH
    const refreshRes = await refreshUseCase.execute(
      new RefreshTokenCommand(loginRes.sessionId, loginRes.refreshToken),
    );
    expect(refreshRes.userId).toBe('user-1');
    expect(refreshRes.nextRefreshToken).toBeDefined();

    // 4. LOGOUT
    await logoutUseCase.execute(new LogoutCommand(loginRes.sessionId));
    const session = await sessionRepo.findById(loginRes.sessionId);
    expect(session!.getIsRevoked()).toBe(true);
  });

  it('should deny login with invalid password', async () => {
    await registerUseCase.execute(
      new RegisterUserCommand(
        'user-1',
        'landlord@test.com',
        'SecurePassword123',
        UserRole.LANDLORD,
      ),
    );

    await expect(
      loginUseCase.execute(new LoginCommand('landlord@test.com', 'WrongPassword123')),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('should revoke the entire family session and deny refresh on token reuse detection', async () => {
    await registerUseCase.execute(
      new RegisterUserCommand(
        'user-1',
        'landlord@test.com',
        'SecurePassword123',
        UserRole.LANDLORD,
      ),
    );
    const loginRes = await loginUseCase.execute(
      new LoginCommand('landlord@test.com', 'SecurePassword123'),
    );

    // Refresh once (using initial token) -> yields next token
    const refreshRes1 = await refreshUseCase.execute(
      new RefreshTokenCommand(loginRes.sessionId, loginRes.refreshToken),
    );

    // Attempt to reuse initial token again (hijack/replay attack!)
    await expect(
      refreshUseCase.execute(new RefreshTokenCommand(loginRes.sessionId, loginRes.refreshToken)),
    ).rejects.toThrow(RefreshSessionTokenReuseDetectedError);

    // Verify session family is fully revoked
    const session = await sessionRepo.findById(loginRes.sessionId);
    expect(session!.getIsRevoked()).toBe(true);

    // Attempting to refresh with the next token must also be denied
    await expect(
      refreshUseCase.execute(
        new RefreshTokenCommand(loginRes.sessionId, refreshRes1.nextRefreshToken),
      ),
    ).rejects.toThrow(RefreshSessionTokenReuseDetectedError);
  });

  it('should successfully change user password, and also support bulk session revocation', async () => {
    await registerUseCase.execute(
      new RegisterUserCommand(
        'user-123',
        'tenant@test.com',
        'OldSecurePassword123',
        UserRole.TENANT,
      ),
    );
    const loginRes = await loginUseCase.execute(
      new LoginCommand('tenant@test.com', 'OldSecurePassword123'),
    );
    expect(loginRes.userId).toBe('user-123');

    // Change password
    await changePasswordUseCase.execute(
      new ChangePasswordCommand('user-123', 'OldSecurePassword123', 'NewSecurePassword999'),
    );

    // Verify login with old password fails
    await expect(
      loginUseCase.execute(new LoginCommand('tenant@test.com', 'OldSecurePassword123')),
    ).rejects.toThrow(InvalidCredentialsError);

    // Verify login with new password succeeds
    const nextLogin = await loginUseCase.execute(
      new LoginCommand('tenant@test.com', 'NewSecurePassword999'),
    );
    expect(nextLogin.userId).toBe('user-123');

    // Revoke all sessions
    await revokeSessionsUseCase.execute(new RevokeSessionsCommand('user-123'));
    const firstSession = await sessionRepo.findById(loginRes.sessionId);
    const secondSession = await sessionRepo.findById(nextLogin.sessionId);
    expect(firstSession!.getIsRevoked()).toBe(true);
    expect(secondSession!.getIsRevoked()).toBe(true);

    // Get current actor details
    const actor = await getCurrentActorUseCase.execute(new GetCurrentActorQuery('user-123'));
    expect(actor.id).toBe('user-123');
    expect(actor.email).toBe('tenant@test.com');
  });
});
