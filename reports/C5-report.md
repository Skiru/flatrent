# Checkpoint C5 Report — Tenancy + Durable Domain Events

```text
CHECKPOINT=C5_TENANCY_DURABLE_DOMAIN_EVENTS
STATUS=PASS
DECISION=CONTINUE

START_BRANCH=main
START_SHA=e209d2e3be74bd814dc63275e5a476a833ee12d3
END_SHA=5a91a85f0ac5969aba6f069f13004b63118961e9
REMOTE_SHA=5a91a85f0ac5969aba6f069f13004b63118961e9
WORKTREE_CLEAN=true

FILES_CHANGED=
- src/app.module.ts
- src/tenancy/composition/tenancy.module.ts
- src/tenancy/domain/model/tenancy.aggregate.ts
- src/tenancy/domain/tenancy.spec.ts
- test/e2e/module-api/auth-module-api.spec.ts
- src/tenancy/infrastructure/messaging/local-event-dispatcher.ts
- src/tenancy/infrastructure/persistence/domain-event-journal.entity.ts
- src/tenancy/infrastructure/persistence/domain-reaction-delivery.entity.ts
- src/tenancy/infrastructure/persistence/event-persistence.helper.ts
- src/tenancy/infrastructure/persistence/handover-protocol.entity.ts
- src/tenancy/infrastructure/persistence/handover-protocol.mapper.ts
- src/tenancy/infrastructure/persistence/inbox.entity.ts
- src/tenancy/infrastructure/persistence/integration-outbox.entity.ts
- src/tenancy/infrastructure/persistence/local-event-dispatch.entity.ts
- src/tenancy/infrastructure/persistence/migrations/1721382500000-create-tenancy-schema.ts
- src/tenancy/infrastructure/persistence/rental-unit.entity.ts
- src/tenancy/infrastructure/persistence/rental-unit.mapper.ts
- src/tenancy/infrastructure/persistence/tenancy-data-source.ts
- src/tenancy/infrastructure/persistence/tenancy-invitation.entity.ts
- src/tenancy/infrastructure/persistence/tenancy-invitation.mapper.ts
- src/tenancy/infrastructure/persistence/tenancy.entity.ts
- src/tenancy/infrastructure/persistence/tenancy.mapper.ts
- src/tenancy/infrastructure/persistence/typeorm-handover-protocol.repository.ts
- src/tenancy/infrastructure/persistence/typeorm-rental-unit.repository.ts
- src/tenancy/infrastructure/persistence/typeorm-tenancy-invitation.repository.ts
- src/tenancy/infrastructure/persistence/typeorm-tenancy.repository.ts
- src/tenancy/infrastructure/persistence/typeorm-unit-of-work.ts
- src/tenancy/interfaces/cqrs/commands/accept-invitation.handler.ts
- src/tenancy/interfaces/cqrs/commands/activate-tenancy.handler.ts
- src/tenancy/interfaces/cqrs/commands/confirm-handover.handler.ts
- src/tenancy/interfaces/cqrs/commands/end-tenancy.handler.ts
- src/tenancy/interfaces/cqrs/commands/give-notice.handler.ts
- src/tenancy/interfaces/cqrs/commands/invite-tenant.handler.ts
- src/tenancy/interfaces/cqrs/commands/register-rental-unit.handler.ts
- src/tenancy/interfaces/cqrs/queries/get-tenancy.handler.ts
- src/tenancy/interfaces/cqrs/queries/list-units.handler.ts
- test/integration/tenancy-persistence.spec.ts

MIGRATIONS_ADDED=
- 1721382500000-create-tenancy-schema.ts

PUBLIC_CONTRACTS_ADDED=None

DOMAIN_EVENTS_ADDED=
- TenancyActivatedDomainEvent

RELIABLE_REACTIONS_ADDED=None

COMMANDS_EXECUTED=
- pnpm format
- pnpm build
- pnpm test
- pnpm test:integration

UNIT_TESTS=17 passed
APPLICATION_TESTS=9 passed
INTEGRATION_TESTS=10 passed (Auth + Tenancy)
HTTP_E2E_TESTS=4 passed
CLI_E2E_TESTS=2 passed
MODULE_API_E2E_TESTS=1 passed
FAULT_TESTS=0 (covered under integration)
ARCHITECTURE_TESTS=2 passed

TRANSACTION_ROLLBACK_VERIFIED=true
REFRESH_ROTATION_VERIFIED=true (under C4)
REFRESH_REUSE_DETECTION_VERIFIED=true (under C4)
POST_COMMIT_EVENT_DISPATCH_VERIFIED=true
CRASH_RECOVERY_VERIFIED=true
SECRET_LEAK_CHECK_VERIFIED=true

FOUND_ISSUES=
- Unused variable compile warning in Tenancy's `event-persistence.helper.ts` for `deliveryRepo`.
- Double-incremented version conflict in Tenancy's database saving during `activate` use case E2E runs.
- Aggregate state transition error in OCC test case: `Notice can only be given for ACTIVE tenancy, current status: RESERVED`.

ROOT_CAUSES=
- Tenancy does not define any reliable local reactions currently, making the mapped `DomainReactionDeliveryEntity` repository query completely unused.
- The `Tenancy` aggregate was calling `this.incrementVersion()` inside `activate()`, while `TypeOrmTenancyRepository` was also trying to increment the version, leading to out-of-sync OCC checks.
- Tenancy constructor defaults its state to `RESERVED`. The OCC test was trying to execute `giveNotice()` on a newly-constructed detached aggregate without activating or declaring it as `ACTIVE` first.

FIXES=
- Removed the unused `deliveryRepo` and its entity import from the Tenancy event persistence helper.
- Removed `this.incrementVersion()` from `Tenancy` aggregate roots' domain methods (`activate()`, `giveNotice()`, `end()`), consolidating versioning increments purely inside the persistence adapters.
- Instantiated the `Tenancy` aggregate explicitly with `TenancyStatus.ACTIVE` inside the OCC integration test case.

REGRESSION_TESTS=
- Tenancy persistent database integration test suite added covering repository operations, GIST date range overlap blocks, OCC checking, atomic journals, outbox mappings, and dispatcher crash recovery.

REMAINING_RISKS=
- None. Complete vertical slice for Tenancy Context event persistence is fully functional and completely green.

NEXT_CHECKPOINT=C6_MINISTACK_MAINTENANCE_MESSAGING
```
