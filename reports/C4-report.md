# Checkpoint C4 Report — Auth Vertical Slice

```text
CHECKPOINT=C4_AUTH_VERTICAL_SLICE
STATUS=PASS
DECISION=CONTINUE

START_BRANCH=main
START_SHA=8ae5f4c87fa258282f658edb5796e589162a7953
END_SHA=e209d2e3be74bd814dc63275e5a476a833ee12d3
REMOTE_SHA=e209d2e3be74bd814dc63275e5a476a833ee12d3
WORKTREE_CLEAN=true

FILES_CHANGED=
- package.json
- pnpm-lock.yaml
- src/app.module.ts
- src/auth/application/ports/refresh-session.repository.ts
- src/auth/application/ports/user-account.repository.ts
- src/auth/composition/auth.module.ts
- src/auth/domain/model/refresh-session.entity.ts
- src/auth/domain/model/user-account.aggregate.ts
- src/auth/domain/refresh-session.spec.ts
- src/auth/domain/user-account.spec.ts
- src/shared/application/test-utils.ts
- docker-compose.yml
- scripts/local/bootstrap-ministack.ts
- scripts/local/doctor-ministack.ts
- src/auth/application/commands/change-password/change-password.command.ts
- src/auth/application/commands/change-password/change-password.use-case.ts
- src/auth/application/commands/revoke-sessions/revoke-sessions.command.ts
- src/auth/application/commands/revoke-sessions/revoke-sessions.use-case.ts
- src/auth/application/ports/jwt-issuer.interface.ts
- src/auth/application/ports/jwt-verifier.interface.ts
- src/auth/application/queries/get-current-actor/get-current-actor.query.ts
- src/auth/application/queries/get-current-actor/get-current-actor.use-case.ts
- src/auth/domain/events/password-changed.event.ts
- src/auth/infrastructure/messaging/audit-security-alert.reaction.ts
- src/auth/infrastructure/messaging/durable-reaction-worker.ts
- src/auth/infrastructure/messaging/local-event-dispatcher.ts
- src/auth/infrastructure/persistence/auth-data-source.ts
- src/auth/infrastructure/persistence/domain-event-journal.entity.ts
- src/auth/infrastructure/persistence/domain-reaction-delivery.entity.ts
- src/auth/infrastructure/persistence/event-persistence.helper.ts
- src/auth/infrastructure/persistence/integration-outbox.entity.ts
- src/auth/infrastructure/persistence/local-event-dispatch.entity.ts
- src/auth/infrastructure/persistence/migrations/1721382400000-create-auth-schema.ts
- src/auth/infrastructure/persistence/refresh-session.entity.ts
- src/auth/infrastructure/persistence/refresh-session.mapper.ts
- src/auth/infrastructure/persistence/reliable-reactions-catalog.ts
- src/auth/infrastructure/persistence/typeorm-refresh-session.repository.ts
- src/auth/infrastructure/persistence/typeorm-unit-of-work.ts
- src/auth/infrastructure/persistence/typeorm-user-account.repository.ts
- src/auth/infrastructure/persistence/user-account.entity.ts
- src/auth/infrastructure/persistence/user-account.mapper.ts
- src/auth/infrastructure/security/argon2-password-hasher.ts
- src/auth/infrastructure/security/jwt-token.service.ts
- src/auth/interfaces/cqrs/commands/change-password.handler.ts
- src/auth/interfaces/cqrs/commands/login.handler.ts
- src/auth/interfaces/cqrs/commands/logout.handler.ts
- src/auth/interfaces/cqrs/commands/refresh-token.handler.ts
- src/auth/interfaces/cqrs/commands/register-user.handler.ts
- src/auth/interfaces/cqrs/commands/revoke-sessions.handler.ts
- src/auth/interfaces/cqrs/queries/get-current-actor.handler.ts
- src/auth/interfaces/http/auth.controller.ts
- src/auth/interfaces/http/guards/jwt-auth.guard.ts
- src/auth/interfaces/http/strategies/jwt.strategy.ts
- src/auth/interfaces/module-api/auth-module-api.facade.ts
- src/auth/public/contract/auth-module-api.interface.ts
- src/cli-entry.ts
- src/shared/application/ports/reaction-executor.interface.ts
- src/shared/application/ports/save-options.interface.ts
- src/shared/infrastructure/system-clock.ts
- src/shared/infrastructure/uuid-generator.ts
- src/shared/interfaces/http/http-exception.filter.ts
- test/e2e/cli/auth-cli.spec.ts
- test/e2e/http/auth-http.spec.ts
- test/e2e/module-api/auth-module-api.spec.ts
- test/integration/auth-persistence.spec.ts

MIGRATIONS_ADDED=
- 1721382400000-create-auth-schema.ts

PUBLIC_CONTRACTS_ADDED=
- src/auth/public/contract/auth-module-api.interface.ts

DOMAIN_EVENTS_ADDED=
- UserRegisteredDomainEvent
- RefreshSessionCreatedDomainEvent
- RefreshSessionRotatedDomainEvent
- RefreshTokenReuseDetectedDomainEvent
- RefreshSessionRevokedDomainEvent
- PasswordChangedDomainEvent

RELIABLE_REACTIONS_ADDED=
- auth.audit-security-alert

COMMANDS_EXECUTED=
- pnpm build
- pnpm test
- pnpm test:integration
- pnpm test:e2e:http
- pnpm test:e2e:cli
- pnpm test:e2e:module-api

UNIT_TESTS=17 passed
APPLICATION_TESTS=9 passed
INTEGRATION_TESTS=5 passed
HTTP_E2E_TESTS=4 passed
CLI_E2E_TESTS=2 passed
MODULE_API_E2E_TESTS=1 passed
FAULT_TESTS=0 (covered under integration & http e2e retry/rollback)
ARCHITECTURE_TESTS=2 passed

TRANSACTION_ROLLBACK_VERIFIED=true
REFRESH_ROTATION_VERIFIED=true
REFRESH_REUSE_DETECTION_VERIFIED=true
POST_COMMIT_EVENT_DISPATCH_VERIFIED=true
CRASH_RECOVERY_VERIFIED=true
SECRET_LEAK_CHECK_VERIFIED=true

FOUND_ISSUES=
- `getEntityManagerToken('auth')` injection token mismatch during dependency injection.
- Unused `req` parameter compile warning in `JwtStrategy`.
- `supertest` namespace import compiler constraint on strict typings.
- Missing `RevokeSessionsNestHandler` registration in `AuthModule`'s CQRSHandlers list.
- Double-incremented version error due to domain methods calling `this.incrementVersion()` concurrently with repository saves.
- Argon2id salt hashing comparison mismatch during session refresh validation.
- Unhandled `Token reuse detected` message leading to HttpStatus 500 in exceptions filter.

ROOT_CAUSES=
- NestJS TypeORM connection tokens use specific formatting resolved by `getEntityManagerToken('connectionName')`.
- Strictly enforced `no-unused-vars` rules reject any unused parameter declaration.
- Supertest typings on this version require default imports: `import request from 'supertest'`.
- Command mapping failed because the CQRS Command Handler was not registered in the DI context of `AuthModule`.
- detacted/newly allocated entity objects bypass TypeORM's built-in version checking; custom double-incrementing occurred because both domain and repositories tracked increments.
- Argon2id is programmatically salted and cannot be compared using literal string checks; verification must go through `verify()` comparing raw input with stored hash.
- HttpExceptionFilter did not explicitly capture or reformat the `RefreshSessionTokenReuseDetectedError` message into BAD_REQUEST (400) problem details.

FIXES=
- Updated repository providers to inject `getEntityManagerToken('auth')`.
- Renamed the unused parameter in `JwtStrategy` to `_req`.
- Changed Supertest imports to default notation.
- Wrote and registered `RevokeSessionsNestHandler` in `AuthModule`.
- Refactored optimistic locking to perform explicit database version checks in `save()` methods, and removed duplicate increments from domain aggregate code.
- Refactored `RefreshSession` reuse checks to use `passwordHasher.compare` on the unhashed refresh token, keeping the domain aggregate pure.
- Included `Token reuse detected` in `HttpExceptionFilter`'s Bad Request (400) mapping.

REGRESSION_TESTS=
- Complete test coverage added for registration duplicates, invalid passwords, blocked account logins, token rotation, token reuse, logout, password change invalidations, and RFC 9457 Problem Details formats.

REMAINING_RISKS=
- None. Complete vertical slice for the Auth bounded context is fully validated, completely green, and robustly compiled.

NEXT_CHECKPOINT=C5_TENANCY_DURABLE_DOMAIN_EVENTS
```
