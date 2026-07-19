import { Module, Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule, getEntityManagerToken } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { EntityManager } from 'typeorm';

// Entities
import { UserAccountEntity } from '../infrastructure/persistence/user-account.entity';
import { RefreshSessionEntity } from '../infrastructure/persistence/refresh-session.entity';
import { DomainEventJournalEntity } from '../infrastructure/persistence/domain-event-journal.entity';
import { LocalEventDispatchEntity } from '../infrastructure/persistence/local-event-dispatch.entity';
import { DomainReactionDeliveryEntity } from '../infrastructure/persistence/domain-reaction-delivery.entity';
import { IntegrationOutboxEntity } from '../infrastructure/persistence/integration-outbox.entity';

// Repositories & UoW Ports
import { USER_ACCOUNT_REPOSITORY_TOKEN } from '../application/ports/user-account.repository';
import { REFRESH_SESSION_REPOSITORY_TOKEN } from '../application/ports/refresh-session.repository';
import { TypeOrmUserAccountRepository } from '../infrastructure/persistence/typeorm-user-account.repository';
import { TypeOrmRefreshSessionRepository } from '../infrastructure/persistence/typeorm-refresh-session.repository';
import { UNIT_OF_WORK_TOKEN } from '../../shared/application/ports/unit-of-work.interface';
import { TypeOrmUnitOfWork } from '../infrastructure/persistence/typeorm-unit-of-work';

// Security Ports
import { PASSWORD_HASHER_TOKEN } from '../application/ports/password-hasher.interface';
import { Argon2PasswordHasher } from '../infrastructure/security/argon2-password-hasher';
import { JWT_ISSUER_TOKEN } from '../application/ports/jwt-issuer.interface';
import { JWT_VERIFIER_TOKEN } from '../application/ports/jwt-verifier.interface';
import { JwtTokenService } from '../infrastructure/security/jwt-token.service';

// Shared Ports
import { ID_GENERATOR_TOKEN } from '../../shared/application/ports/id-generator.interface';
import { UuidGenerator } from '../../shared/infrastructure/uuid-generator';
import { SystemClock } from '../../shared/infrastructure/system-clock';

// Use cases
import { RegisterUserUseCase } from '../application/commands/register-user/register-user.use-case';
import { LoginUseCase } from '../application/commands/login/login.use-case';
import { RefreshTokenUseCase } from '../application/commands/refresh-token/refresh-token.use-case';
import { LogoutUseCase } from '../application/commands/logout/logout.use-case';
import { ChangePasswordUseCase } from '../application/commands/change-password/change-password.use-case';
import { RevokeSessionsUseCase } from '../application/commands/revoke-sessions/revoke-sessions.use-case';
import { GetCurrentActorUseCase } from '../application/queries/get-current-actor/get-current-actor.use-case';

// CQRS Handlers
import { RegisterUserNestHandler } from '../interfaces/cqrs/commands/register-user.handler';
import { LoginNestHandler } from '../interfaces/cqrs/commands/login.handler';
import { RefreshTokenNestHandler } from '../interfaces/cqrs/commands/refresh-token.handler';
import { LogoutNestHandler } from '../interfaces/cqrs/commands/logout.handler';
import { ChangePasswordNestHandler } from '../interfaces/cqrs/commands/change-password.handler';
import { RevokeSessionsNestHandler } from '../interfaces/cqrs/commands/revoke-sessions.handler';
import { GetCurrentActorNestHandler } from '../interfaces/cqrs/queries/get-current-actor.handler';

// Facades & Interfaces
import { AUTH_MODULE_API_TOKEN } from '../public/contract/auth-module-api.interface';
import { AuthModuleApiFacade } from '../interfaces/module-api/auth-module-api.facade';
import { AuthController } from '../interfaces/http/auth.controller';
import { JwtStrategy } from '../interfaces/http/strategies/jwt.strategy';

const UseCaseProviders: Provider[] = [
  {
    provide: RegisterUserUseCase,
    useFactory: (userRepo, hasher, idGen, clock) =>
      new RegisterUserUseCase(userRepo, hasher, idGen, clock),
    inject: [USER_ACCOUNT_REPOSITORY_TOKEN, PASSWORD_HASHER_TOKEN, ID_GENERATOR_TOKEN, SystemClock],
  },
  {
    provide: LoginUseCase,
    useFactory: (userRepo, sessionRepo, hasher, idGen, clock) =>
      new LoginUseCase(userRepo, sessionRepo, hasher, idGen, clock),
    inject: [
      USER_ACCOUNT_REPOSITORY_TOKEN,
      REFRESH_SESSION_REPOSITORY_TOKEN,
      PASSWORD_HASHER_TOKEN,
      ID_GENERATOR_TOKEN,
      SystemClock,
    ],
  },
  {
    provide: RefreshTokenUseCase,
    useFactory: (sessionRepo, userRepo, hasher, idGen, clock) =>
      new RefreshTokenUseCase(sessionRepo, userRepo, hasher, idGen, clock),
    inject: [
      REFRESH_SESSION_REPOSITORY_TOKEN,
      USER_ACCOUNT_REPOSITORY_TOKEN,
      PASSWORD_HASHER_TOKEN,
      ID_GENERATOR_TOKEN,
      SystemClock,
    ],
  },
  {
    provide: LogoutUseCase,
    useFactory: (sessionRepo) => new LogoutUseCase(sessionRepo),
    inject: [REFRESH_SESSION_REPOSITORY_TOKEN],
  },
  {
    provide: ChangePasswordUseCase,
    useFactory: (userRepo, hasher, idGen, clock) =>
      new ChangePasswordUseCase(userRepo, hasher, idGen, clock),
    inject: [USER_ACCOUNT_REPOSITORY_TOKEN, PASSWORD_HASHER_TOKEN, ID_GENERATOR_TOKEN, SystemClock],
  },
  {
    provide: RevokeSessionsUseCase,
    useFactory: (sessionRepo) => new RevokeSessionsUseCase(sessionRepo),
    inject: [REFRESH_SESSION_REPOSITORY_TOKEN],
  },
  {
    provide: GetCurrentActorUseCase,
    useFactory: (userRepo) => new GetCurrentActorUseCase(userRepo),
    inject: [USER_ACCOUNT_REPOSITORY_TOKEN],
  },
];

const RepositoryProviders: Provider[] = [
  {
    provide: USER_ACCOUNT_REPOSITORY_TOKEN,
    useFactory: (em: EntityManager) => new TypeOrmUserAccountRepository(em),
    inject: [getEntityManagerToken('auth')], // Injected from Named Connection 'auth'
  },
  {
    provide: REFRESH_SESSION_REPOSITORY_TOKEN,
    useFactory: (em: EntityManager) => new TypeOrmRefreshSessionRepository(em),
    inject: [getEntityManagerToken('auth')],
  },
  {
    provide: UNIT_OF_WORK_TOKEN,
    useFactory: (em: EntityManager) => new TypeOrmUnitOfWork(em),
    inject: [getEntityManagerToken('auth')],
  },
];

const SecurityProviders: Provider[] = [
  {
    provide: PASSWORD_HASHER_TOKEN,
    useClass: Argon2PasswordHasher,
  },
  {
    provide: JwtTokenService,
    useClass: JwtTokenService,
  },
  {
    provide: JWT_ISSUER_TOKEN,
    useExisting: JwtTokenService,
  },
  {
    provide: JWT_VERIFIER_TOKEN,
    useExisting: JwtTokenService,
  },
  JwtStrategy,
];

const SharedProviders: Provider[] = [
  {
    provide: ID_GENERATOR_TOKEN,
    useClass: UuidGenerator,
  },
  SystemClock,
];

const CQRSHandlers = [
  RegisterUserNestHandler,
  LoginNestHandler,
  RefreshTokenNestHandler,
  LogoutNestHandler,
  ChangePasswordNestHandler,
  RevokeSessionsNestHandler,
  GetCurrentActorNestHandler,
];

@Module({
  imports: [
    CqrsModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    TypeOrmModule.forFeature(
      [
        UserAccountEntity,
        RefreshSessionEntity,
        DomainEventJournalEntity,
        LocalEventDispatchEntity,
        DomainReactionDeliveryEntity,
        IntegrationOutboxEntity,
      ],
      'auth', // bound to Named Connection 'auth'
    ),
  ],
  controllers: [AuthController],
  providers: [
    ...UseCaseProviders,
    ...RepositoryProviders,
    ...SecurityProviders,
    ...SharedProviders,
    ...CQRSHandlers,
    {
      provide: AUTH_MODULE_API_TOKEN,
      useClass: AuthModuleApiFacade,
    },
  ],
  exports: [AUTH_MODULE_API_TOKEN, JWT_VERIFIER_TOKEN],
})
export class AuthModule {}
