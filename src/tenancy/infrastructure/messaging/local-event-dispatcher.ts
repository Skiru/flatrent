import { EntityManager } from 'typeorm';
import { EventBus } from '@nestjs/cqrs';
import { LocalEventDispatchEntity } from '../persistence/local-event-dispatch.entity';
import { DomainEventJournalEntity } from '../persistence/domain-event-journal.entity';
import { DomainEvent } from '../../../shared/domain/domain-event.interface';

export class LocalEventDispatcher {
  constructor(
    private readonly defaultEntityManager: EntityManager,
    private readonly eventBus?: EventBus,
  ) {}

  public async dispatchPendingEvents(transactionalEntityManager?: unknown): Promise<void> {
    const manager = (transactionalEntityManager as EntityManager) || this.defaultEntityManager;

    await manager.transaction(async (txManager) => {
      const dispatchRepo = txManager.getRepository(LocalEventDispatchEntity);
      const journalRepo = txManager.getRepository(DomainEventJournalEntity);

      const pendingDispatches = await dispatchRepo.find({
        where: { status: 'PENDING' },
        take: 10,
        order: { availableAt: 'ASC' },
      });

      if (pendingDispatches.length === 0) {
        return;
      }

      for (const dispatch of pendingDispatches) {
        dispatch.status = 'PROCESSING';
        dispatch.attemptCount++;
        await dispatchRepo.save(dispatch);

        const journalEvent = await journalRepo.findOne({
          where: { eventId: dispatch.eventId },
        });

        if (!journalEvent) {
          dispatch.status = 'DEAD';
          dispatch.lastError = 'Canonical journal event not found for dispatch.';
          await dispatchRepo.save(dispatch);
          continue;
        }

        const domainEvent: DomainEvent = {
          eventId: journalEvent.eventId,
          eventType: journalEvent.eventType,
          eventVersion: journalEvent.eventVersion,
          occurredAt: journalEvent.occurredAt.toISOString(),
          aggregateId: journalEvent.aggregateId,
          aggregateType: journalEvent.aggregateType,
          aggregateVersion: journalEvent.aggregateVersion,
          payload: JSON.parse(journalEvent.payloadJson),
        };

        try {
          if (this.eventBus) {
            await this.eventBus.publish(domainEvent);
          } else {
            console.log(
              `[TEST_MOCK_DISPATCH_TENANCY] Broadcasted: ${domainEvent.aggregateType}.${domainEvent.eventType}`,
            );
          }

          dispatch.status = 'DISPATCHED';
          dispatch.dispatchedAt = new Date();
          await dispatchRepo.save(dispatch);
        } catch (err: unknown) {
          dispatch.status = 'PENDING';
          dispatch.lastError = err instanceof Error ? err.message : String(err);
          await dispatchRepo.save(dispatch);
        }
      }
    });
  }
}
