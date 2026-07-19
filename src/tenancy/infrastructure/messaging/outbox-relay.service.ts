import { EntityManager } from 'typeorm';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { IntegrationOutboxEntity } from '../persistence/integration-outbox.entity';
import { MetricsRegistry } from '../../../shared/infrastructure/metrics/metrics-registry';

export class OutboxRelayService {
  private readonly maxAttempts = 5;

  constructor(
    private readonly defaultEntityManager: EntityManager,
    private readonly snsClient: SNSClient,
    private readonly topicArn: string,
    private readonly metricsRegistry?: MetricsRegistry,
  ) {}

  /**
   * Processes a single batch of outstanding outbox integration events
   * and publishes them asynchronously to SNS outside DB locks.
   */
  public async relayPendingMessages(transactionalEntityManager?: unknown): Promise<number> {
    const manager = (transactionalEntityManager as EntityManager) || this.defaultEntityManager;

    // 1. Claim a batch of pending outbox rows in a short transaction
    const batch = await manager.transaction(async (txManager) => {
      const outboxRepo = txManager.getRepository(IntegrationOutboxEntity);

      const pending = await outboxRepo
        .createQueryBuilder('outbox')
        .setLock('pessimistic_write')
        .where('outbox.status IN (:...statuses)', { statuses: ['PENDING', 'RETRY'] })
        .andWhere('outbox.attemptCount < :maxAttempts', { maxAttempts: this.maxAttempts })
        .take(10)
        .getMany();

      if (pending.length === 0) {
        return [];
      }

      for (const item of pending) {
        item.status = 'PROCESSING';
        item.attemptCount++;
        await outboxRepo.save(item);
      }

      return pending;
    });

    if (batch.length === 0) {
      return 0;
    }

    // 2. Publish outside the transaction scope to avoid holding DB connection locks!
    for (const item of batch) {
      try {
        await this.snsClient.send(
          new PublishCommand({
            TopicArn: this.topicArn,
            Message: JSON.stringify({
              messageId: item.messageId,
              eventType: item.eventType,
              eventVersion: item.eventVersion,
              producer: item.producer,
              sourceDomainEventId: item.sourceDomainEventId,
              aggregateType: item.aggregateType,
              aggregateId: item.aggregateId,
              aggregateVersion: item.aggregateVersion,
              occurredAt: item.occurredAt.toISOString(),
              payload: JSON.parse(item.payloadJson),
            }),
            MessageAttributes: {
              producer: {
                DataType: 'String',
                StringValue: item.producer, // Filter policy matching
              },
              eventType: {
                DataType: 'String',
                StringValue: item.eventType,
              },
            },
          }),
        );

        // Update database row on successful publish
        await manager
          .getRepository(IntegrationOutboxEntity)
          .update({ messageId: item.messageId }, { status: 'PUBLISHED', lastError: null });
      } catch (err: unknown) {
        const nextStatus = item.attemptCount >= this.maxAttempts ? 'DEAD' : 'RETRY';
        if (nextStatus === 'RETRY') {
          this.metricsRegistry?.incrementOutboxRetry();
        }
        await manager
          .getRepository(IntegrationOutboxEntity)
          .update(
            { messageId: item.messageId },
            { status: nextStatus, lastError: err instanceof Error ? err.message : String(err) },
          );
      }
    }

    return batch.length;
  }
}
