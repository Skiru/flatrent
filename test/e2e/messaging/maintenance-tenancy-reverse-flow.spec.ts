import { SNSClient } from '@aws-sdk/client-sns';
import { SQSClient } from '@aws-sdk/client-sqs';
import {
  DynamoDBClient,
  ScanCommand,
  DeleteItemCommand,
  PutItemCommand,
} from '@aws-sdk/client-dynamodb';
import { tenancyDataSource } from '../../../src/tenancy/infrastructure/persistence/tenancy-data-source';
import { TypeOrmRentalUnitRepository } from '../../../src/tenancy/infrastructure/persistence/typeorm-rental-unit.repository';
import { TypeOrmHandoverProtocolRepository } from '../../../src/tenancy/infrastructure/persistence/typeorm-handover-protocol.repository';
import { TypeOrmTenancyRepository } from '../../../src/tenancy/infrastructure/persistence/typeorm-tenancy.repository';
import { DynamoDBMaintenanceRepository } from '../../../src/maintenance/infrastructure/persistence/dynamodb-maintenance.repository';
import { DynamoDBOutboxRelayService } from '../../../src/maintenance/infrastructure/messaging/dynamodb-outbox-relay.service';
import { MaintenanceEventsConsumer } from '../../../src/tenancy/interfaces/sqs/maintenance-events.consumer';
import { ActivateTenancyUseCase } from '../../../src/tenancy/application/commands/activate-tenancy/activate-tenancy.use-case';
import { ActivateTenancyCommand } from '../../../src/tenancy/application/commands/activate-tenancy/activate-tenancy.command';
import { TypeOrmRentalUnitReadinessAdapter } from '../../../src/tenancy/infrastructure/persistence/typeorm-rental-unit-readiness.adapter';
import { RentalUnitReadinessProjectionEntity } from '../../../src/tenancy/infrastructure/persistence/rental-unit-readiness-projection.entity';
import {
  RentalUnitNotReadyError,
  ReadinessProjectionStale,
} from '../../../src/tenancy/application/ports/rental-unit-readiness.port';
import { RentalUnit } from '../../../src/tenancy/domain/model/rental-unit.aggregate';
import { HandoverProtocol } from '../../../src/tenancy/domain/model/handover-protocol.aggregate';
import { Tenancy, TenancyStatus } from '../../../src/tenancy/domain/model/tenancy.aggregate';
import { MaintenanceRequest } from '../../../src/maintenance/domain/model/maintenance-request.aggregate';
import { UuidGenerator } from '../../../src/shared/infrastructure/uuid-generator';
import { MockClock } from '../../../src/shared/application/test-utils';
import * as crypto from 'crypto';

function loadEnv() {
  const fs = require('fs');
  const path = require('path');
  const p = path.resolve(__dirname, '../../../.env');
  if (fs.existsSync(p)) {
    const content = fs.readFileSync(p, 'utf-8');
    content.split('\n').forEach((line: string) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const parts = trimmed.split('=');
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim();
        process.env[key] = val;
      }
    });
  }
}

loadEnv();

const AWS_ENDPOINT_URL = process.env.AWS_ENDPOINT_URL || 'http://localhost:4566';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const DYNAMODB_MAINTENANCE_TABLE =
  process.env.DYNAMODB_MAINTENANCE_TABLE || 'flatren-maintenance-requests';
const SNS_INTEGRATION_EVENTS_TOPIC_ARN = process.env.SNS_INTEGRATION_EVENTS_TOPIC_ARN || '';
const SQS_TENANCY_QUEUE_URL = process.env.SQS_TENANCY_QUEUE_URL || '';

describe('Asynchronous Maintenance-to-Tenancy Reverse Integration Flow', () => {
  let snsClient: SNSClient;
  let sqsClient: SQSClient;
  let ddbClient: DynamoDBClient;

  let unitRepo: TypeOrmRentalUnitRepository;
  let handoverRepo: TypeOrmHandoverProtocolRepository;
  let tenancyRepo: TypeOrmTenancyRepository;

  let ddbRequestRepo: DynamoDBMaintenanceRepository;
  let ddbOutboxRelay: DynamoDBOutboxRelayService;
  let tenancyInboxConsumer: MaintenanceEventsConsumer;

  let readinessAdapter: TypeOrmRentalUnitReadinessAdapter;
  let activateTenancyUseCase: ActivateTenancyUseCase;

  beforeAll(async () => {
    const awsConfig = {
      endpoint: AWS_ENDPOINT_URL,
      region: AWS_REGION,
      credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
    };
    snsClient = new SNSClient(awsConfig);
    sqsClient = new SQSClient(awsConfig);
    ddbClient = new DynamoDBClient(awsConfig);

    if (!tenancyDataSource.isInitialized) {
      await tenancyDataSource.initialize();
    }
    await tenancyDataSource.dropDatabase();
    await tenancyDataSource.runMigrations();

    unitRepo = new TypeOrmRentalUnitRepository(tenancyDataSource.manager);
    handoverRepo = new TypeOrmHandoverProtocolRepository(tenancyDataSource.manager);
    tenancyRepo = new TypeOrmTenancyRepository(tenancyDataSource.manager);

    ddbRequestRepo = new DynamoDBMaintenanceRepository(ddbClient, DYNAMODB_MAINTENANCE_TABLE);
    ddbOutboxRelay = new DynamoDBOutboxRelayService(
      ddbClient,
      snsClient,
      DYNAMODB_MAINTENANCE_TABLE,
      SNS_INTEGRATION_EVENTS_TOPIC_ARN,
    );
    tenancyInboxConsumer = new MaintenanceEventsConsumer(
      sqsClient,
      tenancyDataSource.manager,
      SQS_TENANCY_QUEUE_URL,
    );

    readinessAdapter = new TypeOrmRentalUnitReadinessAdapter(tenancyDataSource.manager);
    activateTenancyUseCase = new ActivateTenancyUseCase(
      tenancyRepo,
      handoverRepo,
      readinessAdapter,
      new UuidGenerator(),
      new MockClock(),
    );
  });

  afterAll(async () => {
    if (tenancyDataSource.isInitialized) {
      await tenancyDataSource.destroy();
    }
  });

  beforeEach(async () => {
    await tenancyDataSource.query('TRUNCATE TABLE rental_units CASCADE');
    await tenancyDataSource.query('TRUNCATE TABLE handover_protocols CASCADE');
    await tenancyDataSource.query('TRUNCATE TABLE tenancies CASCADE');
    await tenancyDataSource.query('TRUNCATE TABLE rental_unit_readiness_projections CASCADE');
    await tenancyDataSource.query('TRUNCATE TABLE inbox CASCADE');

    const scanRes = await ddbClient.send(
      new ScanCommand({ TableName: DYNAMODB_MAINTENANCE_TABLE }),
    );
    const items = scanRes.Items || [];
    for (const item of items) {
      await ddbClient.send(
        new DeleteItemCommand({
          TableName: DYNAMODB_MAINTENANCE_TABLE,
          Key: { PK: item.PK, SK: item.SK },
        }),
      );
    }
  });

  it('should physically block tenancy activations on active blocking repairs or version gaps, and complete cleanly on resolution', async () => {
    const ownerId = crypto.randomUUID();
    const tenantId = crypto.randomUUID();
    const unitId = crypto.randomUUID();
    const tenancyId = crypto.randomUUID();
    const handoverId = crypto.randomUUID();

    // 1. Setup Unit and reserved tenancy
    await unitRepo.save(new RentalUnit(unitId, ownerId, '123 Reverse Rd'));
    const tenancy = new Tenancy(
      tenancyId,
      unitId,
      tenantId,
      new Date(),
      new Date(),
      TenancyStatus.RESERVED,
    );
    await tenancyRepo.save(tenancy);

    const handover = new HandoverProtocol(handoverId, tenancyId);
    handover.close();
    await handoverRepo.save(handover);

    // 2. Open a blocking repair request in Maintenance Context (Emergency triggers outbox)
    const requestId = crypto.randomUUID();
    const request = new MaintenanceRequest(
      requestId,
      unitId,
      tenantId,
      'Severe water leak flooding the floor',
    );
    await ddbRequestRepo.save(request);

    // 3. Relay Maintenance Outbox to SNS
    await ddbOutboxRelay.relayPendingMessages();

    // Wait for SQS delivery
    await new Promise((resolve) => setTimeout(resolve, 800));

    // 4. Tenancy Inbox consumes event and projects Blocked state (`isReady = false`)
    await tenancyInboxConsumer.pollAndProcess();

    // Verify DB projection state is not ready
    const projection = await tenancyDataSource
      .getRepository(RentalUnitReadinessProjectionEntity)
      .findOneBy({ rentalUnitId: unitId });
    expect(projection).toBeDefined();
    expect(projection!.isReady).toBe(false);
    expect(projection!.status).toBe('ACTIVE');

    // 5. Fail-closed Check: attempt to activate tenancy must be BLOCKED with RentalUnitNotReadyError!
    await expect(
      activateTenancyUseCase.execute(new ActivateTenancyCommand(tenancyId, handoverId)),
    ).rejects.toThrow(RentalUnitNotReadyError);

    // 6. Simulate Event Version Gap: insert a resolved event with version 3 instead of 2 (skipping 2!)
    // We manually write a gap event to Maintenance Outbox in DynamoDB
    const messageId = crypto.randomUUID();
    await ddbClient.send(
      new PutItemCommand({
        TableName: DYNAMODB_MAINTENANCE_TABLE,
        Item: {
          PK: { S: `OUTBOX#${messageId}` },
          SK: { S: `OUTBOX#${messageId}` },
          messageId: { S: messageId },
          eventType: { S: 'MaintenanceRequestResolved.v1' },
          eventVersion: { N: '1' },
          producer: { S: 'maintenance' },
          sourceDomainEventId: { S: messageId },
          aggregateType: { S: 'MaintenanceRequest' },
          aggregateId: { S: requestId },
          aggregateVersion: { N: '3' }, // Gap: version 3! (current processed version is 1)
          occurredAt: { S: new Date().toISOString() },
          status: { S: 'PENDING' },
          attemptCount: { N: '0' },
          payloadJson: {
            S: JSON.stringify({
              requestId,
              rentalUnitId: unitId,
              isBlocking: false,
              version: 3,
            }),
          },
        },
      }),
    );

    // Relay gap event and consume
    await ddbOutboxRelay.relayPendingMessages();
    await new Promise((resolve) => setTimeout(resolve, 800));
    await tenancyInboxConsumer.pollAndProcess();

    // Verify DB projection status is flagged as GAP_DETECTED
    const gapProjection = await tenancyDataSource
      .getRepository(RentalUnitReadinessProjectionEntity)
      .findOneBy({ rentalUnitId: unitId });
    expect(gapProjection!.status).toBe('GAP_DETECTED');

    // 7. Fail-closed Gap Check: attempt to activate tenancy must be BLOCKED with ReadinessProjectionStale!
    await expect(
      activateTenancyUseCase.execute(new ActivateTenancyCommand(tenancyId, handoverId)),
    ).rejects.toThrow(ReadinessProjectionStale);

    // 8. Reconcile/Resolve issues: manually reset state to normal resolved state
    await tenancyDataSource
      .getRepository(RentalUnitReadinessProjectionEntity)
      .update(
        { rentalUnitId: unitId },
        { isReady: true, status: 'ACTIVE', lastProcessedVersion: 2 },
      );

    // 9. Now activation completes successfully with no errors!
    const activeRes = await activateTenancyUseCase.execute(
      new ActivateTenancyCommand(tenancyId, handoverId),
    );
    expect(activeRes.status).toBe(TenancyStatus.ACTIVE);
  });
});
