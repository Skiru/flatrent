import { Test, TestingModule } from '@nestjs/testing';
import { Module, Inject } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../../../src/auth/composition/auth.module';
import { AUTH_MODULE_API_TOKEN, AuthModuleApi } from '../../../src/auth/public/contract/auth-module-api.interface';
import { authDataSource, authDataSourceOptions } from '../../../src/auth/infrastructure/persistence/auth-data-source';
import { RegisterUserUseCase } from '../../../src/auth/application/commands/register-user/register-user.use-case';
import { RegisterUserCommand } from '../../../src/auth/application/commands/register-user/register-user.command';
import { LoginUseCase } from '../../../src/auth/application/commands/login/login.use-case';
import { LoginCommand } from '../../../src/auth/application/commands/login/login.command';
import { JwtIssuer, JWT_ISSUER_TOKEN } from '../../../src/auth/application/ports/jwt-issuer.interface';
import { UserRole } from '../../../src/auth/domain/model/user-account.aggregate';
import * as crypto from 'crypto';

// Minimal Foreign Consumer Module that ONLY imports AuthModule public contracts
@Module({
  imports: [
    TypeOrmModule.forRoot({ ...authDataSourceOptions, name: 'auth' }),
    AuthModule,
  ],
})
class ConsumerTestModule {
  constructor(
    @Inject(AUTH_MODULE_API_TOKEN)
    public readonly authApi: AuthModuleApi,
  ) {}
}

describe('Auth Context Module API E2E Tests', () => {
  let consumerModule: TestingModule;
  let authApi: AuthModuleApi;
  let registerUseCase: RegisterUserUseCase;
  let loginUseCase: LoginUseCase;
  let jwtIssuer: JwtIssuer;

  beforeAll(async () => {
    if (!authDataSource.isInitialized) {
      await authDataSource.initialize();
    }
    await authDataSource.dropDatabase();
    await authDataSource.runMigrations();

    consumerModule = await Test.createTestingModule({
      imports: [ConsumerTestModule],
    }).compile();

    await consumerModule.init(); // Execute lifecycle hooks to register CQRS Handlers!

    authApi = consumerModule.get<AuthModuleApi>(AUTH_MODULE_API_TOKEN);
    registerUseCase = consumerModule.get<RegisterUserUseCase>(RegisterUserUseCase);
    loginUseCase = consumerModule.get<LoginUseCase>(LoginUseCase);
    jwtIssuer = consumerModule.get<JwtIssuer>(JWT_ISSUER_TOKEN);
  });

  afterAll(async () => {
    await consumerModule.close();
    if (authDataSource.isInitialized) {
      await authDataSource.destroy();
    }
  });

  beforeEach(async () => {
    await authDataSource.query('TRUNCATE TABLE user_accounts CASCADE');
    await authDataSource.query('TRUNCATE TABLE refresh_sessions CASCADE');
  });

  it('should successfully authenticate access token and query snapshots using ONLY public Module API contracts', async () => {
    const userId = crypto.randomUUID();
    const email = 'public.facade@flatren.com';
    const password = 'SecurePassword123';
    const role = UserRole.LANDLORD;

    // 1. Create User
    await registerUseCase.execute(new RegisterUserCommand(userId, email, password, role));

    // 2. Login to get session
    const loginRes = await loginUseCase.execute(new LoginCommand(email, password));

    // 3. Issue signed JWT access token via asymmetric private key
    const token = await jwtIssuer.issueAccessToken({
      sub: userId,
      email,
      role,
      sid: loginRes.sessionId,
    });

    // 4. Authenticate token via Module API contract
    const actor = await authApi.authenticateAccessToken(token);
    expect(actor.id).toBe(userId);
    expect(actor.email).toBe(email);
    expect(actor.role).toBe(role);
    expect(actor.status).toBe('ACTIVE');

    // 5. Query actor snapshot by ID via Module API contract
    const snapshot = await authApi.getActorSnapshot(userId);
    expect(snapshot.id).toBe(userId);
    expect(snapshot.email).toBe(email);
    expect(snapshot.role).toBe(role);
  });
});
