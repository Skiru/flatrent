import { DynamoDBClient, ScanCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

export class DynamoDBOutboxRelayService {
  private readonly maxAttempts = 5;

  constructor(
    private readonly ddbClient: DynamoDBClient,
    private readonly snsClient: SNSClient,
    private readonly tableName: string,
    private readonly topicArn: string,
  ) {}

  /**
   * Scans DynamoDB for outstanding PENDING outbox items,
   * publishes them to SNS, and marks them PUBLISHED.
   */
  public async relayPendingMessages(): Promise<number> {
    try {
      // Find pending outbox items
      const scanRes = await this.ddbClient.send(
        new ScanCommand({
          TableName: this.tableName,
          FilterExpression: 'begins_with(PK, :prefix) AND (#status = :pending OR #status = :retry)',
          ExpressionAttributeNames: {
            '#status': 'status',
          },
          ExpressionAttributeValues: {
            ':prefix': { S: 'OUTBOX#' },
            ':pending': { S: 'PENDING' },
            ':retry': { S: 'RETRY' },
          },
        }),
      );

      const items = scanRes.Items || [];
      if (items.length === 0) {
        return 0;
      }

      for (const item of items) {
        const messageId = item.messageId.S!;
        const eventType = item.eventType.S!;
        const eventVersion = parseInt(item.eventVersion.N!, 10);
        const producer = item.producer.S!;
        const sourceDomainEventId = item.sourceDomainEventId.S!;
        const aggregateType = item.aggregateType.S!;
        const aggregateId = item.aggregateId.S!;
        const aggregateVersion = parseInt(item.aggregateVersion.N!, 10);
        const occurredAt = item.occurredAt.S!;
        const payload = JSON.parse(item.payloadJson.S!);
        const attemptCount = parseInt(item.attemptCount.N || '0', 10);

        try {
          // Update status to PROCESSING to avoid concurrent duplicates
          item.status.S = 'PROCESSING';
          item.attemptCount.N = String(attemptCount + 1);
          await this.ddbClient.send(new PutItemCommand({ TableName: this.tableName, Item: item }));

          // Publish to SNS
          await this.snsClient.send(
            new PublishCommand({
              TopicArn: this.topicArn,
              Message: JSON.stringify({
                messageId,
                eventType,
                eventVersion,
                producer,
                sourceDomainEventId,
                aggregateType,
                aggregateId,
                aggregateVersion,
                occurredAt,
                payload,
              }),
              MessageAttributes: {
                producer: {
                  DataType: 'String',
                  StringValue: producer,
                },
                eventType: {
                  DataType: 'String',
                  StringValue: eventType,
                },
              },
            }),
          );

          // Mark PUBLISHED
          item.status.S = 'PUBLISHED';
          item.lastError = { NULL: true };
          await this.ddbClient.send(new PutItemCommand({ TableName: this.tableName, Item: item }));
        } catch (err: unknown) {
          const nextStatus = attemptCount + 1 >= this.maxAttempts ? 'DEAD' : 'RETRY';
          item.status.S = nextStatus;
          item.lastError = { S: err instanceof Error ? err.message : String(err) };
          await this.ddbClient.send(new PutItemCommand({ TableName: this.tableName, Item: item }));
        }
      }

      return items.length;
    } catch (err: unknown) {
      console.error(
        'DynamoDB Outbox Relay error:',
        err instanceof Error ? err.message : String(err),
      );
      return 0;
    }
  }
}
export const DYNAMODB_OUTBOX_RELAY_SERVICE_TOKEN = 'DynamoDBOutboxRelayService';
