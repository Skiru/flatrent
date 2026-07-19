# Flatren File-Level Implementation Plan

This plan maps out all modules, layers, and concrete files to be created or modified from Checkpoint C1 through C9.

## 1. Project Root & Monorepo Structure

- `pnpm-workspace.yaml` — Defines workspace packages.
- `package.json` — Monorepo root dependencies, script gates.
- `docker-compose.yml` — Runs MiniStack (`ministackorg/ministack:1.3.72`) and PostgreSQL/Redis/DynamoDB emulation.
- `.env` — Local environment parameters.
- `tsconfig.json` — Strict compiler configuration.
- `dependency-cruiser.js` — Restricts layer and module boundaries.
- `tools/verify` — Central shell/fish verifier script.

---

## 2. Directory Layout per Module

Each of our three modules (`auth`, `tenancy`, `maintenance`) follows this layout under `src/<module>/`:

```text
src/<module>/
├── domain/                  # Pure Business Logic (No frameworks)
│   ├── model/               # Aggregate roots, Entities, Value objects
│   ├── events/              # Domain Event definitions
│   └── policies/            # Business policies & invariants
│
├── application/             # Use Cases & Application Ports
│   ├── commands/            # Command commands, use cases, results, errors
│   ├── queries/             # Query query classes, handlers, read models
│   └── ports/               # Outbound ports (Repository / Module interfaces)
│
├── interfaces/              # Inbound Adapters (NestJS, HTTP, CLI, SQS)
│   ├── http/                # Controllers, Zod validation pipes, route guards
│   ├── cli/                 # Commander commands
│   ├── cqrs/                # Nest Command/Query/Event Handler thin adapters
│   └── sqs/                 # SQS message consumers
│
├── infrastructure/          # Outbound Adapters (TypeORM, AWS, Redis)
│   ├── persistence/         # TypeORM schemas, Data Mappers, repositories
│   ├── integrations/        # ACL implementations & remote Module API adapters
│   └── messaging/           # SNS/SQS outbox publishers
│
├── public/                  # Public API contract of this package
│   ├── contract/            # Interface definitions, DTOs
│   └── token.ts             # DI injection tokens for other modules
│
└── composition/             # NestJS DI Module & Wire-up
    └── <module>.module.ts   # Entry Module binding adapters to ports
```

---

## 3. Detailed File Listing

### 3.1 `auth` Module
- `src/auth/domain/model/user-account.aggregate.ts`
- `src/auth/domain/model/refresh-session.entity.ts`
- `src/auth/domain/policies/password.policy.ts`
- `src/auth/application/commands/register-user/`
- `src/auth/application/commands/login/`
- `src/auth/application/commands/refresh-token/`
- `src/auth/application/commands/logout/`
- `src/auth/application/ports/user-account.repository.interface.ts`
- `src/auth/interfaces/http/auth.controller.ts`
- `src/auth/interfaces/http/guards/jwt.guard.ts`
- `src/auth/infrastructure/persistence/typeorm-user-account.repository.ts`
- `src/auth/public/auth-module-api.interface.ts`

### 3.2 `tenancy` Module
- `src/tenancy/domain/model/rental-unit.aggregate.ts`
- `src/tenancy/domain/model/tenancy.aggregate.ts`
- `src/tenancy/domain/model/tenancy-invitation.aggregate.ts`
- `src/tenancy/domain/model/handover-protocol.aggregate.ts`
- `src/tenancy/application/commands/register-rental-unit/`
- `src/tenancy/application/commands/invite-tenant/`
- `src/tenancy/application/commands/accept-invitation/`
- `src/tenancy/application/commands/confirm-handover/`
- `src/tenancy/application/commands/activate-tenancy/`
- `src/tenancy/application/queries/get-tenancy/`
- `src/tenancy/application/ports/tenancy.repository.interface.ts`
- `src/tenancy/infrastructure/persistence/typeorm-tenancy.repository.ts`
- `src/tenancy/infrastructure/persistence/domain-event-journal.sql`
- `src/tenancy/infrastructure/persistence/reliable-reactions.sql`
- `src/tenancy/infrastructure/persistence/outbox.sql`
- `src/tenancy/interfaces/http/tenancy.controller.ts`

### 3.3 `maintenance` Module
- `src/maintenance/domain/model/maintenance-request.aggregate.ts`
- `src/maintenance/application/commands/open-maintenance-request/`
- `src/maintenance/application/commands/schedule-visit/`
- `src/maintenance/application/commands/resolve-request/`
- `src/maintenance/application/ports/maintenance.repository.interface.ts`
- `src/maintenance/infrastructure/persistence/dynamodb-maintenance.repository.ts`
- `src/maintenance/interfaces/http/maintenance.controller.ts`
- `src/maintenance/interfaces/sqs/tenancy-events.consumer.ts`

---

## 4. Verification Gates and Commands

- `pnpm format:check` — Runs Prettier code style validation.
- `pnpm lint` — Runs ESLint for syntax and layer imports.
- `pnpm typecheck` — Compiles TypeScript strictly without emitting code.
- `pnpm architecture:check` — Runs `dependency-cruiser` layered validation.
- `pnpm test:unit` — Runs pure domain unit tests.
- `pnpm test:application` — Runs application usecase unit tests.
- `pnpm test:integration` — Runs real database/MQ/Redis integration tests.
- `pnpm test:e2e` — Runs complete end-to-end flow checks.
- `pnpm verify:full` — Starts clean infrastructure, runs migrations, executes all gates, and downs cleanly.
