# ADR-005: Durable Domain Events and Reliable Reaction Delivery

## Status
Accepted

## Context
When business actions complete, we need to execute multiple secondary reactions (e.g., creating move-in checklists, updating read models, publishing integration events to other modules). Running these synchronously inside the primary transaction degrades performance and risks cascade failures. Broadcasting them as fire-and-forget post-commit events is fragile and can lead to lost events on application crashes.

## Decision
We implement a robust, transactionally guaranteed domain-event journaling and reaction delivery mechanism:
1. **No Framework Auto-Commit**: Aggregate roots only record events in-memory (`recordDomainEvent()`). They never publish them directly.
2. **Transactional Database Journaling**: Inside the primary database transaction, we atomically save:
   - The aggregate's state.
   - An append-only canonical domain event envelope in the `domain_event_journal` table (with sequential `commit_position` and versioned uniqueness: `UNIQUE(module, aggregate_type, aggregate_id, aggregate_version, event_index)`).
   - A `local_event_dispatches` tracker row to coordinate post-commit publication.
   - Distinct targeted reaction rows in `domain_reaction_deliveries` for each reliable local handler defined in the static catalog.
   - Cross-module public integration events in `integration_outbox`.
3. **No Network I/O in Transactions**: We strictly prohibit network operations (SNS publish, SQS send, HTTP, remote Module APIs) inside local database transactions.
4. **Canonical Post-Commit Dispatch**: Once the transaction successfully commits, the aggregate event buffer is cleared. A post-commit dispatcher claims the pending `local_event_dispatches` row, reads the canonical envelope from the journal, broadcasts it on the Nest `EventBus`, and marks it as `DISPATCHED`.
5. **Targeted Reaction Retry**: If a reliable reaction fails, we never rebroadcast the entire domain event (which would trigger all observers and cause duplicates). A dedicated reaction worker independently claims and retries exactly that failed `domain_reaction_deliveries` row, executing the targeted reaction command.

## Consequences
- Guaranteed eventual consistency: all registered reactions and outbox messages are guaranteed to execute at-least-once, even across service crashes.
- High database performance: write paths are lightweight, and slow operations are safely deferred to background workers.
- Zero risk of circular dependency deadlocks caused by network blocks inside DB transactions.
