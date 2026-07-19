import { EntityManager } from 'typeorm';
import { EventBus } from '@nestjs/cqrs';
import { LocalEventDispatchEntity } from '../persistence/local-event-dispatch.entity';
import { DomainEventJournalEntity } from '../persistence/domain-event-journal.entity';
import { DomainEvent } from '../../../shared/domain/domain-event.interface';

export class LocalEventDispatcher {
  constructor(
    private readonly defaultEntityManager: EntityManager,
    private readonly eventBus?: EventBus, // NestJS EventBus is optional for unit testing
  ) {}

  /**
   * Scans for PENDING local event dispatches, loads canonical envelopes,
   * publishes them on NestJS EventBus, and marks them as DISPATCHED.
   */
  public async dispatchPendingEvents(transactionalEntityManager?: unknown): Promise<void> {
    const manager = (transactionalEntityManager as EntityManager) || this.defaultEntityManager;

    // Use a short database transaction/lock to claim PENDING dispatches
    await manager.transaction(async (txManager) => {
      const dispatchRepo = txManager.getRepository(LocalEventDispatchEntity);
      const journalRepo = txManager.getRepository(DomainEventJournalEntity);

      // 1. Fetch pending dispatches (bounded batch)
      const pendingDispatches = await dispatchRepo.find({
        where: { status: 'PENDING' },
        take: 10,
        order: { availableAt: 'ASC' },
      });

      if (pendingDispatches.length === 0) {
        return;
      }

      for (const dispatch of pendingDispatches) {
        // Mark as PROCESSING to avoid concurrent duplicate dispatches
        dispatch.status = 'PROCESSING';
        dispatch.attemptCount++;
        await dispatchRepo.save(dispatch);

        // Load canonical event envelope
        const journalEvent = await journalRepo.findOne({
          where: { eventId: dispatch.eventId },
        });

        if (!journalEvent) {
          dispatch.status = 'DEAD';
          dispatch.lastError = 'Canonical journal event not found for dispatch.';
          await dispatchRepo.save(dispatch);
          continue;
        }

        // Reconstruct the DomainEvent envelope
        const domainEvent: DomainEvent = {
          eventId: journalEvent.eventId,
          eventType: journalEvent.eventType,
          eventVersion: journalEvent.eventVersion,
          occurredAt: journalEvent.occurredAt.toISOString(),
          aggregateId: journalEvent.aggregateId,
          aggregateType: journalEvent.aggregateType,
          payload: JSON.parse(journalEvent.payloadJson),
        };

        try {
          // Publish on NestJS EventBus if available
          if (this.eventBus) {
            await this.eventBus.publish(domainEvent);
          } else {
            console.log(`[TEST_MOCK_DISPATCH] Broadcasted: ${eventKey(domainEvent)}`);
          }

          // Mark as DISPATCHED
          dispatch.status = 'DISPATCHED';
          dispatch.dispatchedAt = new Date();
          await dispatchRepo.save(dispatch);
        } catch (err: unknown) {
          // Fail-safe retry tracking
          dispatch.status = 'PENDING'; // revert for retry
          dispatch.lastError = err instanceof Error ? err.message : String(err);
          await dispatchRepo.save(dispatch);
        }
      }
    });
  }
}

function eventKey(event: DomainEvent): string {
  return `${event.aggregateType}.${event.eventType}@${event.aggregateId}`;
}
export const LOCAL_EVENT_DISPATCHER_TOKEN = 'LocalEventDispatcher';
