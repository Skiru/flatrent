import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
} from '@aws-sdk/client-dynamodb';
import { MaintenanceRequestRepository } from '../../application/ports/maintenance-request.repository';
import { MaintenanceRequest, MaintenanceStatus } from '../../domain/model/maintenance-request.aggregate';

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
    } catch (err: any) {
      console.error('DynamoDB findById error:', err.message);
      return null;
    }
  }

  public async save(request: MaintenanceRequest): Promise<void> {
    const pk = `REQUEST#${request.id}`;
    const currentVersion = request.getVersion();

    // 1. Map to DynamoDB Attributes
    const item: Record<string, any> = {
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
      item.assignedHandymanId = { S: request.getAssignedHandymanId() };
    }
    if (request.getVisitDate()) {
      item.visitDate = { S: request.getVisitDate()!.toISOString() };
    }
    if (request.getResolutionDescription()) {
      item.resolutionDescription = { S: request.getResolutionDescription() };
    }

    // 2. Preflight Transaction-Budget Guard Check
    const serializedSize = Buffer.byteLength(JSON.stringify(item), 'utf-8');
    if (serializedSize > this.maxTransactionSize) {
      throw new Error(`Transaction Budget Exceeded: Payload size ${serializedSize} bytes exceeds the 4 MB DynamoDB limit.`);
    }

    // 3. Write to DynamoDB with Optimistic Concurrency Control (OCC)
    try {
      if (currentVersion === 0) {
        // First insert: expect item to not exist
        await this.client.send(
          new PutItemCommand({
            TableName: this.tableName,
            Item: item,
            ConditionExpression: 'attribute_not_exists(PK)',
          }),
        );
      } else {
        // Update: expect database version to match aggregate version
        await this.client.send(
          new PutItemCommand({
            TableName: this.tableName,
            Item: item,
            ConditionExpression: 'version = :expectedVersion',
            ExpressionAttributeValues: {
              ':expectedVersion': { N: String(currentVersion) },
            },
          }),
        );
      }
      // On successful write, align local version
      request.incrementVersion();
    } catch (err: any) {
      if (err.name === 'ConditionalCheckFailedException') {
        throw new Error('Optimistic Lock Conflict: Stale version detected. DynamoDB update blocked.');
      }
      throw err;
    }
  }
}
