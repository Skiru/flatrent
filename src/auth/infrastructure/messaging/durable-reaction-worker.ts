import { EntityManager } from 'typeorm';
import { DomainReactionDeliveryEntity } from '../persistence/domain-reaction-delivery.entity';
import { DomainEventJournalEntity } from '../persistence/domain-event-journal.entity';
import { ReactionExecutor } from '../../../shared/application/ports/reaction-executor.interface';
import { DomainEvent } from '../../../shared/domain/domain-event.interface';

export class DurableReactionWorker {
  private readonly maxAttempts = 5;

  constructor(
    private readonly defaultEntityManager: EntityManager,
    private readonly executors: readonly ReactionExecutor[],
  ) {}

  /**
   * Scans and processes a single outstanding reliable local reaction delivery.
   */
  public async processNextPendingDelivery(transactionalEntityManager?: unknown): Promise<boolean> {
    const manager = (transactionalEntityManager as EntityManager) || this.defaultEntityManager;

    // Run within a transaction to claim and lock the delivery row
    return manager.transaction(async (txManager) => {
      const deliveryRepo = txManager.getRepository(DomainReactionDeliveryEntity);
      const journalRepo = txManager.getRepository(DomainEventJournalEntity);

      const now = new Date();

      // Find one due delivery item
      const delivery = await deliveryRepo
        .createQueryBuilder('delivery')
        .setLock('pessimistic_write')
        .where('delivery.status IN (:...statuses)', { statuses: ['PENDING', 'RETRY'] })
        .andWhere('delivery.available_at <= :now', { now })
        .orderBy('delivery.available_at', 'ASC')
        .getOne();

      if (!delivery) {
        return false; // No work to do
      }

      // Claim row
      delivery.status = 'PROCESSING';
      delivery.attemptCount++;
      await deliveryRepo.save(delivery);

      // Load canonical event
      const journalEvent = await journalRepo.findOne({ where: { eventId: delivery.eventId } });
      if (!journalEvent) {
        delivery.status = 'DEAD';
        delivery.lastError = 'Canonical domain event not found in journal.';
        await deliveryRepo.save(delivery);
        return true;
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

      // Resolve the exact executor
      const executor = this.executors.find(
        (ex) => ex.reactionId === delivery.reactionId && ex.version === delivery.reactionVersion,
      );

      if (!executor) {
        delivery.status = 'DEAD';
        delivery.lastError = `No registered ReactionExecutor found for reactionId ${delivery.reactionId} v${delivery.reactionVersion}`;
        await deliveryRepo.save(delivery);
        return true;
      }

      try {
        // Execute the business effect and update status in the SAME transaction!
        await executor.execute(domainEvent, txManager);

        delivery.status = 'SUCCEEDED';
        delivery.processedAt = new Date();
        delivery.lastError = null;
        await deliveryRepo.save(delivery);
      } catch (err: unknown) {
        if (delivery.attemptCount >= this.maxAttempts) {
          delivery.status = 'DEAD';
        } else {
          delivery.status = 'RETRY';
          // Exponential backoff with random jitter: (2^attempts * 1000) + random_jitter
          const backoffSec = Math.pow(2, delivery.attemptCount);
          const jitterMs = Math.floor(Math.random() * 1000);
          delivery.availableAt = new Date(Date.now() + backoffSec * 1000 + jitterMs);
        }
        delivery.lastError = err instanceof Error ? err.message : String(err);
        await deliveryRepo.save(delivery);
      }

      return true;
    });
  }
}
