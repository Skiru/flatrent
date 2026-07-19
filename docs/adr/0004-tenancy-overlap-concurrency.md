# ADR-004: Tenancy Overlap Prevention and Concurrency Guard

## Status
Accepted

## Context
A critical business rule in the `tenancy` context is that a rental unit (`RentalUnit`) can have only one active or reserved tenancy (`Tenancy`) for any given time period. Because the system runs concurrently and may receive multiple tenancy activation requests at the same time, simple pre-transaction checks in the application code are insufficient and vulnerable to race conditions (Lost Update or overlapping activations).

## Decision
We enforce a dual-layer strategy to guarantee overlap prevention and concurrency safety:
1. **Aggregates Concurrency Check**: By default, one use case/command modifies exactly one aggregate root. Tenancy activation commands will target and modify the `Tenancy` aggregate itself. To prevent lost updates, we enforce Optimistic Concurrency Control (OCC) using version columns in our state tables:
   ```sql
   UPDATE tenancy SET status = :status, version = version + 1
   WHERE id = :id AND version = :expected_version
   ```
2. **PostgreSQL Race-Safe Occupancy Guard**: Since checking other tenancies' date ranges inside a single tenancy transaction is prone to race conditions, we enforce a physical, concurrent-safe constraint at the database layer. We utilize a PostgreSQL **exclusion constraint** (via `btree_gist` extension) on the `tenancy` table, preventing any overlapping date ranges for the same `rental_unit_id` where the status is active or reserved:
   ```sql
   ALTER TABLE tenancy ADD CONSTRAINT t_no_overlapping_active_rentals
   EXCLUDE USING gist (rental_unit_id WITH =, date_range WITH &&)
   WHERE (status IN ('ACTIVE', 'RESERVED'))
   ```
   If such a constraint is not fully supported by the schema parser, we employ a secure PostgreSQL transaction lock (`SELECT ... FOR UPDATE` on the parent `rental_unit` table) inside the transactional Unit of Work to serialize activations for that unit. This occupancy guard blocks race conditions programmatically and guarantees absolute consistency.

## Consequences
- Guaranteed business consistency: overlapping tenancies are physically impossible at the database layer.
- Thread-safe and race-proof activation flows, fully validated via concurrent E2E fault-injection tests.
- Graceful error mapping: database constraint violations or lock failures are captured and returned to the client as clean `409 Conflict` responses following RFC 9457 format.
