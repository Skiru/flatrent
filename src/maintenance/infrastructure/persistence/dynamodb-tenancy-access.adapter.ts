import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { TenancyAccessPort } from '../../application/ports/tenancy-access.port';

export class DynamoDBTenancyAccessAdapter implements TenancyAccessPort {
  constructor(
    private readonly client: DynamoDBClient,
    private readonly tableName: string,
  ) {}

  public async verifyActiveAccess(userId: string, rentalUnitId: string): Promise<boolean> {
    const pk = `ACCESS#${userId}`;
    const sk = `UNIT#${rentalUnitId}`;

    try {
      const res = await this.client.send(
        new GetItemCommand({
          TableName: this.tableName,
          Key: {
            PK: { S: pk },
            SK: { S: sk },
          },
        }),
      );

      if (!res.Item) {
        return false; // Access snapshot not found
      }

      return res.Item.isActive?.BOOL || false;
    } catch (err: unknown) {
      console.error(
        'DynamoDB TenancyAccess check failed:',
        err instanceof Error ? err.message : String(err),
      );
      return false; // Fail-closed on database exceptions
    }
  }
}
export const DYNAMODB_TENANCY_ACCESS_ADAPTER_TOKEN = 'DynamoDBTenancyAccessAdapter';
