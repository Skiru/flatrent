# ADR-001: Modular Monolith Architecture

## Status
Accepted

## Context
We need a structure that allows rapid development, local testability, and high maintainability, while avoiding the premature complexity and deployment overhead of microservices. At the same time, we must prevent the code from devolving into a spaghetti monolith with tight, uncontrolled coupling between different business domains.

## Decision
We adopt a Modular Monolith architecture for Flatren. The application is a single deployable unit (a monolith), but it is strictly partitioned into independent, self-contained business modules:
1. `auth` — Identity & Access Management (UserAccount, RefreshSession).
2. `tenancy` — Core rental domain (RentalUnit, TenancyInvitation, Tenancy, HandoverProtocol).
3. `maintenance` — Incident handling domain (MaintenanceRequest).

Each module is logically decoupled, owns its persistence, and exposes a clean public interface. Cross-module communications are strictly governed:
- Synchronous calls are allowed only through public Module APIs in a non-cyclic fashion (Allowed directions: Tenancy -> Auth, Maintenance -> Auth, Maintenance -> Tenancy).
- Asynchronous communication is preferred for non-blocking processes and is done via MiniStack SNS/SQS.

## Consequences
- Clean logical boundaries that can be easily split into microservices if needed in the future.
- Fast, local integration testing.
- Prevention of circular module dependencies and spaghetti coupling.
- Enforced modular boundary rules verified using `dependency-cruiser` and architecture tests.
