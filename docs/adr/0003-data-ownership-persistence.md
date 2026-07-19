# ADR-003: Strict Data Ownership and Persistent Models

## Status
Accepted

## Context
Cross-module database coupling (e.g., shared tables, foreign keys across modules, cross-database joins) creates invisible dependencies that break module boundaries, making code modification extremely fragile and preventing independent scaling.

## Decision
We enforce absolute data isolation between modules:
1. **Auth Module**: Owns its dedicated PostgreSQL schema, managed via TypeORM Data Mapper.
2. **Tenancy Module**: Owns its dedicated PostgreSQL schema, managed via TypeORM Data Mapper.
3. **Maintenance Module**: Owns its dedicated DynamoDB table, managed directly using the `@aws-sdk/client-dynamodb` (AWS SDK v3); no TypeORM or relational database is used here.
4. **Redis Cache**: MiniStack ElastiCache is used strictly as a non-authoritative, ephemeral, cache-aside layer. No business state or authorization decisions are solely dependent on Redis.

We strictly prohibit:
- Shared database connections between modules at runtime.
- Shared tables or cross-module database views.
- Foreign keys across modules (cross-module database joins).
- Cross-module TypeORM entity relations.

In our local MiniStack environment, we provision distinct PostgreSQL database instances (or distinct isolated database schemas under different users with least-privilege permissions) to ensure absolute physical isolation. Database migrations are fully isolated and executed using migration users separated from runtime lease accounts. We will write integration tests that programmatically prove cross-database access is denied at runtime.

## Consequences
- Complete database isolation per module, preventing side-channel data coupling.
- High alignment with microservices architecture, simplifying potential future service extraction.
- Strict requirement for explicit cross-module identity mapping and lookup DTOs (e.g., storing UUIDs or ULIDs of external aggregates instead of foreign key constraints).
