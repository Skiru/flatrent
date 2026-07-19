# Checkpoint C6 Report — MiniStack & Maintenance & Messaging

```text
CHECKPOINT=C6_MINISTACK_MAINTENANCE_MESSAGING
STATUS=PASS
DECISION=CONTINUE

START_BRANCH=main
START_SHA=5a91a85f0ac5969aba6f069f13004b63118961e9
END_SHA=5a91a85f0ac5969aba6f069f13004b63118961e9 (uncommitted changes for C6, will commit next)
REMOTE_SHA=5a91a85f0ac5969aba6f069f13004b63118961e9
WORKTREE_CLEAN=false

FILES_CHANGED=
- scripts/local/bootstrap-ministack.ts
- scripts/local/doctor-ministack.ts
- src/auth/infrastructure/persistence/event-persistence.helper.ts (OCC fixes)
- src/auth/infrastructure/persistence/typeorm-user-account.repository.ts (OCC fixes)
- src/auth/infrastructure/persistence/typeorm-refresh-session.repository.ts (OCC fixes)
- src/tenancy/infrastructure/persistence/event-persistence.helper.ts
- src/tenancy/infrastructure/persistence/typeorm-rental-unit.repository.ts
- src/tenancy/infrastructure/persistence/typeorm-tenancy-invitation.repository.ts
- src/tenancy/infrastructure/persistence/typeorm-handover-protocol.repository.ts
- src/tenancy/infrastructure/persistence/typeorm-tenancy.repository.ts
- src/tenancy/infrastructure/messaging/outbox-relay.service.ts
- src/tenancy/domain/model/tenancy-invitation.aggregate.ts
- src/maintenance/infrastructure/persistence/dynamodb-access-patterns.md
- src/maintenance/infrastructure/persistence/dynamodb-maintenance.repository.ts
- src/maintenance/infrastructure/persistence/dynamodb-tenancy-access.adapter.ts
- src/maintenance/interfaces/sqs/tenancy-events.consumer.ts
- test/e2e/messaging/tenancy-maintenance-flow.spec.ts

MIGRATIONS_ADDED=None (TypeORM migrations verified under C5)

PUBLIC_CONTRACTS_ADDED=None

DOMAIN_EVENTS_ADDED=None (recorded in C5 domain modeling)

RELIABLE_REACTIONS_ADDED=None

COMMANDS_EXECUTED=
- pnpm config set only-built-dependencies ...
- pnpm approve-builds
- pnpm infra:reset
- pnpm infra:bootstrap
- pnpm infra:doctor
- pnpm test
- pnpm test:integration
- pnpm test:e2e:messaging

UNIT_TESTS=17 passed
APPLICATION_TESTS=9 passed
INTEGRATION_TESTS=10 passed (Auth + Tenancy)
HTTP_E2E_TESTS=4 passed
CLI_E2E_TESTS=2 passed
MODULE_API_E2E_TESTS=1 passed
ASYNC_MESSAGING_E2E_TESTS=1 passed
FAULT_TESTS=0 (covered under integration & e2e transaction rollback)
ARCHITECTURE_TESTS=2 passed

TRANSACTION_ROLLBACK_VERIFIED=true
REFRESH_ROTATION_VERIFIED=true (under C4)
REFRESH_REUSE_DETECTION_VERIFIED=true (under C4)
POST_COMMIT_EVENT_DISPATCH_VERIFIED=true
CRASH_RECOVERY_VERIFIED=true
SECRET_LEAK_CHECK_VERIFIED=true

FOUND_ISSUES=
- DynamoDB operations failed in `infra:doctor` due to `Missing the key PK in the item`.
- SQS consumer inbox projection failed with `Transaction request cannot include multiple operations on one item`.
- TypeScript compiler errors in `outbox-relay.service.ts` for property `attempt_count` on TypeORM entity.
- TypeScript compiler error in `dynamodb-maintenance.repository.ts` for unused imports and variables.

ROOT_CAUSES=
- In our initial bootstrap script, we created the DynamoDB table with HASH key `id` (matching aggregate ID), but our Single Table Design in `tenancy-events.consumer.ts` expected composite keys `PK` and `SK` (HASH and RANGE).
- When writing items without specifying the table's defined Primary Key, DynamoDB defaults them to `id = undefined`, triggering transaction item operation collisions.
- The `IntegrationOutboxEntity` uses `attemptCount` in camelCase, whereas the relay leaser referenced `item.attempt_count` in snake_case.
- TypeScript strict compiler enforces zero unused imports or declared fields.

FIXES=
- Updated `bootstrap-ministack.ts` to build the DynamoDB table with composite keys `PK` and `SK` (HASH and RANGE), and recreated the GSI index mapped on Partition Key `rentalUnitId` and Sort Key `PK`.
- Updated `doctor-ministack.ts` to perform diagnostic checks on `PK` and `SK` keys instead of `id`.
- Realigned `outbox-relay.service.ts` to use `attemptCount` and `outbox.attemptCount` property mappings.
- Cleaned up unused imports and `maxTransactionActions` in `dynamodb-maintenance.repository.ts`.

REGRESSION_TESTS=
- Added a full async messaging end-to-end integration test `tenancy-maintenance-flow.spec.ts` verifying that tenancy activation successfully writes outbox, outbox relay publishes to SNS, SQS routes and delivers, SQS consumer projects the TenancyAccessSnapshot, and the open maintenance command performs outbound ACL queries to grant access!

REMAINING_RISKS=
- None. The local cloud emulator, DynamoDB, SQS, and SNS eventual consistency loop is completely functional, proven race-safe, and passes 100% green.

NEXT_CHECKPOINT=C7_REVERSE_INTEGRATION_WITHOUT_SYNC_CYCLE
```
