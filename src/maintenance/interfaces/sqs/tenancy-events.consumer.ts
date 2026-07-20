import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { DynamoDBClient, TransactWriteItemsCommand } from '@aws-sdk/client-dynamodb';
import { z } from 'zod';
import * as crypto from 'crypto';

// Integration Event Envelope Zod Validation Schema
const TenancyActivatedEnvelopeSchema = z.object({
  messageId: z.string().uuid(),
  eventType: z.literal('TenancyActivated.v1'),
  producer: z.literal('tenancy'),
  payload: z.object({
    tenancyId: z.string().uuid(),
    rentalUnitId: z.string().uuid(),
    tenantId: z.string().uuid(),
    startDate: z.string(),
    endDate: z.string(),
  }),
});

export class TenancyEventsConsumer {
  constructor(
    private readonly sqsClient: SQSClient,
    private readonly ddbClient: DynamoDBClient,
    private readonly queueUrl: string,
    private readonly tableName: string,
  ) {}

  /**
   * Polls SQS queue, processes TenancyActivated.v1 integration events,
   * and projects TenancyAccessSnapshots atomically inside a DynamoDB transaction.
   */
  public async pollAndProcess(): Promise<number> {
    try {
      const res = await this.sqsClient.send(
        new ReceiveMessageCommand({
          QueueUrl: this.queueUrl,
          MaxNumberOfMessages: 5,
          WaitTimeSeconds: 2, // Short poll for tests/E2E responsiveness
        }),
      );

      const messages = res.Messages || [];
      if (messages.length === 0) {
        return 0;
      }

      for (const msg of messages) {
        // Handle raw or SNS-wrapped envelopes
        const parsedBody = JSON.parse(msg.Body || '{}');
        const eventContent = parsedBody.Message ? JSON.parse(parsedBody.Message) : parsedBody;

        try {
          // 1. Zod Validation at boundary
          const envelope = TenancyActivatedEnvelopeSchema.parse(eventContent);
          const { messageId, payload } = envelope;

          // Compute payload hash to detect poison message alterations
          const payloadHash = crypto
            .createHash('sha256')
            .update(JSON.stringify(payload))
            .digest('hex');

          // 2. Transactional Inbox and Projection writes in DynamoDB
          await this.ddbClient.send(
            new TransactWriteItemsCommand({
              TransactItems: [
                {
                  // A. Unique Inbox Marker to guarantee Idempotency
                  Put: {
                    TableName: this.tableName,
                    Item: {
                      PK: { S: `INBOX#${messageId}` },
                      SK: { S: `INBOX#${messageId}` },
                      payloadHash: { S: payloadHash },
                      processedAt: { S: new Date().toISOString() },
                    },
                    ConditionExpression: 'attribute_not_exists(PK)', // Blocks duplicates!
                  },
                },
                {
                  // B. TenancyAccessSnapshot Projection
                  Put: {
                    TableName: this.tableName,
                    Item: {
                      PK: { S: `ACCESS#${payload.tenantId}` },
                      SK: { S: `UNIT#${payload.rentalUnitId}` },
                      tenantId: { S: payload.tenantId },
                      rentalUnitId: { S: payload.rentalUnitId },
                      tenancyId: { S: payload.tenancyId },
                      isActive: { BOOL: true },
                    },
                  },
                },
              ],
            }),
          );

          console.log(
            `[INBOX] [SUCCESS] Projected access snapshot for tenant ${payload.tenantId} on unit ${payload.rentalUnitId}`,
          );

          // 3. Delete from SQS only after DynamoDB write commits successfully!
          await this.sqsClient.send(
            new DeleteMessageCommand({
              QueueUrl: this.queueUrl,
              ReceiptHandle: msg.ReceiptHandle!,
            }),
          );
        } catch (err: unknown) {
          if (
            err instanceof Error &&
            (err.name === 'ConditionalCheckFailedException' || err.message?.includes('Conditional'))
          ) {
            console.warn(`[INBOX] [WARN] Duplicate message ${eventContent.messageId} skipped.`);
            // Message already processed, safe to delete from SQS
            await this.sqsClient.send(
              new DeleteMessageCommand({
                QueueUrl: this.queueUrl,
                ReceiptHandle: msg.ReceiptHandle!,
              }),
            );
          } else {
            console.error(
              '[INBOX] [FAIL] Inbox processing failed:',
              err instanceof Error ? err.message : String(err),
            );
            // Leave in SQS to trigger redrive policy to DLQ!
          }
        }
      }

      return messages.length;
    } catch (err: unknown) {
      console.error('SQS Consumer poll error:', err instanceof Error ? err.message : String(err));
      return 0;
    }
  }
}
