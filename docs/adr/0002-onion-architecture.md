# ADR-002: Onion Architecture per Module

## Status
Accepted

## Context
Within each module, we need to protect our core business logic from framework and infrastructure changes (NestJS, TypeORM, AWS, Redis, etc.) to ensure readability, testability, and stability.

## Decision
Each module is structured using Onion Architecture, divided into clear layers with inward-facing dependencies:
1. `domain/` — Core business entities, aggregate roots, value objects, domain events, domain policies, and domain service interfaces. This layer is completely pure and has zero external dependencies (no NestJS, TypeORM, AWS, or third-party frameworks).
2. `application/` — Pure application use cases, commands, queries, outbound ports (repository interfaces), and Anti-Corruption Layer (ACL) interfaces. This layer orchestrates domain behavior and is also framework-independent.
3. `interfaces/` — Inbound adapters like HTTP controllers, CLI commands, and SQS consumer handlers. This layer contains NestJS constructs.
4. `infrastructure/` — Outbound adapters like TypeORM database repositories, AWS client integrations, and external integration adapters.
5. `public/` — Public API contract definitions, DTOs, and interface tokens. It represents the package boundary exposed to other modules.
6. `composition/` — NestJS dependency injection modules and framework-specific wire-up classes.

Dependency direction is strictly inward: `interfaces` and `infrastructure` depend on `application`, which depends on `domain`. No layer inside can depend on a layer outside.

## Consequences
- Core business rules are fully decoupled from infrastructure details.
- High testability: domain logic is easily verified with lightweight unit tests, and application use cases are tested with pure unit/application tests using in-memory mock repositories and ports.
- Easy technology swaps: database or message-broker adapters can be modified/replaced in the `infrastructure` layer without touching domain or application logic.
