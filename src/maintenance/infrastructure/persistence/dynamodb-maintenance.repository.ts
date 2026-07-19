import {
  DynamoDBClient,
  GetItemCommand,
  TransactWriteItemsCommand,
  TransactWriteItem,
  AttributeValue,
} from '@aws-sdk/client-dynamodb';
import { MaintenanceRequestRepository } from '../../application/ports/maintenance-request.repository';
import {
  MaintenanceRequest,
  MaintenanceStatus,
} from '../../domain/model/maintenance-request.aggregate';
import * as crypto from 'crypto';

export class DynamoDBMaintenanceRepository implements MaintenanceRequestRepository {
  private readonly maxTransactionSize = 4 * 1024 * 1024; // 4 MB

  constructor(
    private readonly client: DynamoDBClient,
    private readonly tableName: string,
  ) {}

  public async findById(id: string): Promise<MaintenanceRequest | null> {
    const pk = `REQUEST#${id}`;
    try {
      const res = await this.client.send(
        new GetItemCommand({
          TableName: this.tableName,
          Key: {
            PK: { S: pk },
            SK: { S: pk },
          },
        }),
      );

      if (!res.Item) {
        return null;
      }

      const status = res.Item.status?.S as MaintenanceStatus;
      const assignedHandymanId = res.Item.assignedHandymanId?.S || null;
      const visitDate = res.Item.visitDate?.S ? new Date(res.Item.visitDate.S) : null;
      const resolutionDescription = res.Item.resolutionDescription?.S || null;
      const isClosed = res.Item.isClosed?.BOOL || false;
      const version = parseInt(res.Item.version?.N || '0', 10);

      const domain = new MaintenanceRequest(
        res.Item.id!.S!,
        res.Item.rentalUnitId!.S!,
        res.Item.reporterId!.S!,
        res.Item.description!.S!,
        status,
        assignedHandymanId,
        visitDate,
        resolutionDescription,
        isClosed,
      );
      domain.setVersion(version);
      return domain;
    } catch (err: unknown) {
      console.error('DynamoDB findById error:', err instanceof Error ? err.message : String(err));
      return null;
    }
  }

  public async save(request: MaintenanceRequest): Promise<void> {
    const pk = `REQUEST#${request.id}`;
    const currentVersion = request.getVersion();

    // 1. Map Main Request Item
    const item: Record<string, AttributeValue> = {
      PK: { S: pk },
      SK: { S: pk },
      id: { S: request.id },
      rentalUnitId: { S: request.getRentalUnitId() },
      reporterId: { S: request.getReporterId() },
      description: { S: request.getDescription() },
      status: { S: request.getStatus() },
      isEmergency: { BOOL: request.getIsEmergency() },
      isClosed: { BOOL: request.getIsClosed() },
      version: { N: String(currentVersion + 1) },
    };

    if (request.getAssignedHandymanId()) {
      item.assignedHandymanId = { S: request.getAssignedHandymanId() as string };
    }
    if (request.getVisitDate()) {
      item.visitDate = { S: request.getVisitDate()!.toISOString() };
    }
    if (request.getResolutionDescription()) {
      item.resolutionDescription = { S: request.getResolutionDescription() as string };
    }

    // 2. Preflight Transaction-Budget Guard Check
    const serializedSize = Buffer.byteLength(JSON.stringify(item), 'utf-8');
    if (serializedSize > this.maxTransactionSize) {
      throw new Error(
        `Transaction Budget Exceeded: Payload size ${serializedSize} bytes exceeds the 4 MB DynamoDB limit.`,
      );
    }

    // Determine outbox integration event type
    let outboxItem: Record<string, AttributeValue> | null = null;
    const isBlocking = request.getIsEmergency(); // Emergencies are treated as blocking in Flatren
    const messageId = crypto.randomUUID();

    if (currentVersion === 0 && request.getStatus() === MaintenanceStatus.OPENED) {
      // 1. opened blocking request outbox
      outboxItem = {
        PK: { S: `OUTBOX#${messageId}` },
        SK: { S: `OUTBOX#${messageId}` },
        messageId: { S: messageId },
        eventType: { S: 'BlockingMaintenanceRequestOpened.v1' },
        eventVersion: { N: '1' },
        producer: { S: 'maintenance' },
        sourceDomainEventId: { S: messageId },
        aggregateType: { S: 'MaintenanceRequest' },
        aggregateId: { S: request.id },
        aggregateVersion: { N: String(currentVersion + 1) },
        occurredAt: { S: new Date().toISOString() },
        status: { S: 'PENDING' },
        attemptCount: { N: '0' },
        payloadJson: {
          S: JSON.stringify({
            requestId: request.id,
            rentalUnitId: request.getRentalUnitId(),
            isBlocking,
            version: currentVersion + 1, // version is 1 for initial opened event
          }),
        },
      };
    } else if (request.getStatus() === MaintenanceStatus.RESOLVED) {
      // 2. resolved request outbox
      outboxItem = {
        PK: { S: `OUTBOX#${messageId}` },
        SK: { S: `OUTBOX#${messageId}` },
        messageId: { S: messageId },
        eventType: { S: 'MaintenanceRequestResolved.v1' },
        eventVersion: { N: '1' },
        producer: { S: 'maintenance' },
        sourceDomainEventId: { S: messageId },
        aggregateType: { S: 'MaintenanceRequest' },
        aggregateId: { S: request.id },
        aggregateVersion: { N: String(currentVersion + 1) },
        occurredAt: { S: new Date().toISOString() },
        status: { S: 'PENDING' },
        attemptCount: { N: '0' },
        payloadJson: {
          S: JSON.stringify({
            requestId: request.id,
            rentalUnitId: request.getRentalUnitId(),
            isBlocking: false,
            version: currentVersion + 1, // version increments sequence
          }),
        },
      };
    }

    // 3. Compile transaction items
    const transactItems: TransactWriteItem[] = [];

    if (currentVersion === 0) {
      transactItems.push({
        Put: {
          TableName: this.tableName,
          Item: item,
          ConditionExpression: 'attribute_not_exists(PK)',
        },
      });
    } else {
      transactItems.push({
        Put: {
          TableName: this.tableName,
          Item: item,
          ConditionExpression: 'version = :expectedVersion',
          ExpressionAttributeValues: {
            ':expectedVersion': { N: String(currentVersion) },
          },
        },
      });
    }

    if (outboxItem) {
      transactItems.push({
        Put: {
          TableName: this.tableName,
          Item: outboxItem,
        },
      });
    }

    // 4. Execute atomic transaction in DynamoDB
    try {
      await this.client.send(
        new TransactWriteItemsCommand({
          TransactItems: transactItems,
        }),
      );
      request.incrementVersion();
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        err.name === 'TransactionCanceledException' &&
        err.message?.includes('ConditionalCheckFailed')
      ) {
        throw new Error(
          'Optimistic Lock Conflict: Stale version detected. DynamoDB update blocked.',
        );
      }
      throw err;
    }
  }
}
