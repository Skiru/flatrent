import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { EntityManager } from 'typeorm';
import { z } from 'zod';
import { RentalUnitReadinessProjectionEntity } from '../../infrastructure/persistence/rental-unit-readiness-projection.entity';
import { InboxEntity } from '../../infrastructure/persistence/inbox.entity';
import * as crypto from 'crypto';

// Zod schema for incoming maintenance events
const MaintenanceEventEnvelopeSchema = z.object({
  messageId: z.string().uuid(),
  eventType: z.enum(['BlockingMaintenanceRequestOpened.v1', 'MaintenanceRequestResolved.v1']),
  eventVersion: z.number().optional().default(1),
  producer: z.literal('maintenance'),
  payload: z.object({
    requestId: z.string().uuid(),
    rentalUnitId: z.string().uuid(),
    isBlocking: z.boolean(),
    version: z.number(), // sequential version counter for gap detection
  }),
});

export class MaintenanceEventsConsumer {
  constructor(
    private readonly sqsClient: SQSClient,
    private readonly defaultEntityManager: EntityManager,
    private readonly queueUrl: string,
  ) {}

  public async pollAndProcess(): Promise<number> {
    try {
      const res = await this.sqsClient.send(
        new ReceiveMessageCommand({
          QueueUrl: this.queueUrl,
          MaxNumberOfMessages: 5,
          WaitTimeSeconds: 2,
        }),
      );

      const messages = res.Messages || [];
      if (messages.length === 0) {
        return 0;
      }

      for (const msg of messages) {
        const parsedBody = JSON.parse(msg.Body || '{}');
        const eventContent = parsedBody.Message ? JSON.parse(parsedBody.Message) : parsedBody;

        try {
          // 1. Validate envelope
          const envelope = MaintenanceEventEnvelopeSchema.parse(eventContent);
          const { messageId, payload } = envelope;

          const payloadHash = crypto
            .createHash('sha256')
            .update(JSON.stringify(payload))
            .digest('hex');

          // 2. Process inside a SQL transaction for atomicity (state + inbox marker)
          await this.defaultEntityManager.transaction(async (txManager) => {
            const inboxRepo = txManager.getRepository(InboxEntity);
            const projectionRepo = txManager.getRepository(RentalUnitReadinessProjectionEntity);

            // A. Idempotency Check
            const existingInbox = await inboxRepo.findOne({
              where: { consumerName: 'tenancy.readiness-consumer', messageId },
            });
            if (existingInbox) {
              throw new Error('DUPLICATE_MESSAGE_SKIP');
            }

            // Save unique inbox marker to lock message
            const inboxMarker = new InboxEntity();
            inboxMarker.consumerName = 'tenancy.readiness-consumer';
            inboxMarker.messageId = messageId;
            inboxMarker.eventType = envelope.eventType;
            inboxMarker.eventVersion = envelope.eventVersion || 1;
            inboxMarker.payloadHash = payloadHash;
            inboxMarker.sourceAggregateId = payload.requestId;
            inboxMarker.sourceAggregateVersion = payload.version;
            inboxMarker.status = 'PROCESSED';
            inboxMarker.processedAt = new Date();
            await inboxRepo.save(inboxMarker);

            // B. Load current readiness projection
            let projection = await projectionRepo.findOne({
              where: { rentalUnitId: payload.rentalUnitId },
            });

            if (!projection) {
              const newProj = new RentalUnitReadinessProjectionEntity();
              newProj.rentalUnitId = payload.rentalUnitId;
              newProj.isReady = true;
              newProj.lastProcessedVersion = 0;
              newProj.status = 'ACTIVE';
              projection = newProj;
            }

            const incomingVersion = payload.version;
            const currentVersion = projection.lastProcessedVersion;

            if (incomingVersion <= currentVersion) {
              // Stale/duplicate event, no-op
              return;
            }

            if (incomingVersion === currentVersion + 1) {
              // Success: apply transition
              projection.isReady = !payload.isBlocking;
              projection.lastProcessedVersion = incomingVersion;
              projection.status = 'ACTIVE'; // active/restored
            } else {
              // GAP DETECTED!
              console.warn(
                `[GAP DETECTED] Missed messages for unit ${payload.rentalUnitId}. Expected version ${currentVersion + 1}, got ${incomingVersion}. Flagging projection stale.`,
              );
              projection.status = 'GAP_DETECTED';
              // Trigger controlled background reconciliation (mocked for now)
            }

            await projectionRepo.save(projection);
          });

          // 3. Delete from SQS only after SQL transaction successfully commits!
          await this.sqsClient.send(
            new DeleteMessageCommand({
              QueueUrl: this.queueUrl,
              ReceiptHandle: msg.ReceiptHandle!,
            }),
          );
        } catch (err: unknown) {
          if (err instanceof Error && err.message === 'DUPLICATE_MESSAGE_SKIP') {
            await this.sqsClient.send(
              new DeleteMessageCommand({
                QueueUrl: this.queueUrl,
                ReceiptHandle: msg.ReceiptHandle!,
              }),
            );
          } else {
            console.error(
              '[TENANCY_INBOX] [FAIL] Processing failed:',
              err instanceof Error ? err.message : String(err),
            );
          }
        }
      }

      return messages.length;
    } catch (err: unknown) {
      console.error(
        'Tenancy SQS Consumer poll error:',
        err instanceof Error ? err.message : String(err),
      );
      return 0;
    }
  }
}
