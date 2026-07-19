import { SNSClient } from '@aws-sdk/client-sns';
import { SQSClient } from '@aws-sdk/client-sqs';
import { DynamoDBClient, ScanCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import { tenancyDataSource } from '../../../src/tenancy/infrastructure/persistence/tenancy-data-source';
import { TypeOrmRentalUnitRepository } from '../../../src/tenancy/infrastructure/persistence/typeorm-rental-unit.repository';
import { TypeOrmTenancyInvitationRepository } from '../../../src/tenancy/infrastructure/persistence/typeorm-tenancy-invitation.repository';
import { TypeOrmHandoverProtocolRepository } from '../../../src/tenancy/infrastructure/persistence/typeorm-handover-protocol.repository';
import { TypeOrmTenancyRepository } from '../../../src/tenancy/infrastructure/persistence/typeorm-tenancy.repository';
import { TypeOrmUnitOfWork } from '../../../src/tenancy/infrastructure/persistence/typeorm-unit-of-work';
import { OutboxRelayService } from '../../../src/tenancy/infrastructure/messaging/outbox-relay.service';
import { TenancyEventsConsumer } from '../../../src/maintenance/interfaces/sqs/tenancy-events.consumer';
import { DynamoDBMaintenanceRepository } from '../../../src/maintenance/infrastructure/persistence/dynamodb-maintenance.repository';
import { DynamoDBTenancyAccessAdapter } from '../../../src/maintenance/infrastructure/persistence/dynamodb-tenancy-access.adapter';
import { OpenRequestUseCase } from '../../../src/maintenance/application/commands/open-request/open-request.use-case';
import {
  OpenRequestCommand,
  ActiveTenancyRequiredError,
} from '../../../src/maintenance/application/commands/open-request/open-request.command';
import { RentalUnit } from '../../../src/tenancy/domain/model/rental-unit.aggregate';
import { TenancyInvitation } from '../../../src/tenancy/domain/model/tenancy-invitation.aggregate';
import { HandoverProtocol } from '../../../src/tenancy/domain/model/handover-protocol.aggregate';
import { Tenancy, TenancyStatus } from '../../../src/tenancy/domain/model/tenancy.aggregate';
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
const SQS_MAINTENANCE_QUEUE_URL = process.env.SQS_MAINTENANCE_QUEUE_URL || '';

describe('Asynchronous Tenancy-to-Maintenance Outbox-to-Inbox Integration Flow', () => {
  let snsClient: SNSClient;
  let sqsClient: SQSClient;
  let ddbClient: DynamoDBClient;

  let unitRepo: TypeOrmRentalUnitRepository;
  let inviteRepo: TypeOrmTenancyInvitationRepository;
  let handoverRepo: TypeOrmHandoverProtocolRepository;
  let tenancyRepo: TypeOrmTenancyRepository;
  let uow: TypeOrmUnitOfWork;

  let outboxRelay: OutboxRelayService;
  let inboxConsumer: TenancyEventsConsumer;

  let ddbRequestRepo: DynamoDBMaintenanceRepository;
  let ddbAccessAdapter: DynamoDBTenancyAccessAdapter;
  let openRequestUseCase: OpenRequestUseCase;

  beforeAll(async () => {
    // 1. Initialize Clients
    const awsConfig = {
      endpoint: AWS_ENDPOINT_URL,
      region: AWS_REGION,
      credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
    };
    snsClient = new SNSClient(awsConfig);
    sqsClient = new SQSClient(awsConfig);
    ddbClient = new DynamoDBClient(awsConfig);

    // 2. Initialize Tenancy SQL Database
    if (!tenancyDataSource.isInitialized) {
      await tenancyDataSource.initialize();
    }
    await tenancyDataSource.dropDatabase();
    await tenancyDataSource.runMigrations();

    unitRepo = new TypeOrmRentalUnitRepository(tenancyDataSource.manager);
    inviteRepo = new TypeOrmTenancyInvitationRepository(tenancyDataSource.manager);
    handoverRepo = new TypeOrmHandoverProtocolRepository(tenancyDataSource.manager);
    tenancyRepo = new TypeOrmTenancyRepository(tenancyDataSource.manager);
    uow = new TypeOrmUnitOfWork(tenancyDataSource.manager);

    // 3. Initialize background services
    outboxRelay = new OutboxRelayService(
      tenancyDataSource.manager,
      snsClient,
      SNS_INTEGRATION_EVENTS_TOPIC_ARN,
    );
    inboxConsumer = new TenancyEventsConsumer(
      sqsClient,
      ddbClient,
      SQS_MAINTENANCE_QUEUE_URL,
      DYNAMODB_MAINTENANCE_TABLE,
    );

    // 4. Initialize Maintenance DynamoDB interfaces
    ddbRequestRepo = new DynamoDBMaintenanceRepository(ddbClient, DYNAMODB_MAINTENANCE_TABLE);
    ddbAccessAdapter = new DynamoDBTenancyAccessAdapter(ddbClient, DYNAMODB_MAINTENANCE_TABLE);
    openRequestUseCase = new OpenRequestUseCase(ddbRequestRepo, ddbAccessAdapter);
  });

  afterAll(async () => {
    if (tenancyDataSource.isInitialized) {
      await tenancyDataSource.destroy();
    }
  });

  beforeEach(async () => {
    // Clear Tenancy DB
    await tenancyDataSource.query('TRUNCATE TABLE rental_units CASCADE');
    await tenancyDataSource.query('TRUNCATE TABLE tenancy_invitations CASCADE');
    await tenancyDataSource.query('TRUNCATE TABLE handover_protocols CASCADE');
    await tenancyDataSource.query('TRUNCATE TABLE tenancies CASCADE');
    await tenancyDataSource.query('TRUNCATE TABLE domain_event_journal CASCADE');
    await tenancyDataSource.query('TRUNCATE TABLE local_event_dispatches CASCADE');
    await tenancyDataSource.query('TRUNCATE TABLE integration_outbox CASCADE');

    // Clear Maintenance DynamoDB table
    const scanRes = await ddbClient.send(
      new ScanCommand({ TableName: DYNAMODB_MAINTENANCE_TABLE }),
    );
    const items = scanRes.Items || [];
    for (const item of items) {
      const pk = item.PK.S!;
      const sk = item.SK.S!;
      await ddbClient.send(
        new DeleteItemCommand({
          TableName: DYNAMODB_MAINTENANCE_TABLE,
          Key: { PK: { S: pk }, SK: { S: sk } },
        }),
      );
    }
  });

  it('should flow TenancyActivated integration event through Outbox->SNS->SQS->Inbox and grant maintenance access', async () => {
    const ownerId = crypto.randomUUID();
    const tenantId = crypto.randomUUID();
    const unitId = crypto.randomUUID();
    const inviteId = crypto.randomUUID();
    const handoverId = crypto.randomUUID();
    const tenancyId = crypto.randomUUID();

    // 1. Setup landlord unit in Tenancy DB
    await unitRepo.save(new RentalUnit(unitId, ownerId, '789 Distributed Way'));

    // 2. Setup invitation
    const expires = new Date(Date.now() + 86400000);
    const invite = new TenancyInvitation(inviteId, unitId, 'tenant@dist.com', expires);
    await inviteRepo.save(invite);

    // 3. Accept invitation (creates reserved Tenancy)
    invite.accept(new Date());
    await inviteRepo.save(invite);

    const tenancy = new Tenancy(
      tenancyId,
      unitId,
      tenantId,
      new Date(),
      new Date(),
      TenancyStatus.RESERVED,
    );
    await tenancyRepo.save(tenancy);

    // 4. Complete handover protocol
    const handover = new HandoverProtocol(handoverId, tenancyId);
    handover.close();
    await handoverRepo.save(handover);

    // 5. Activate tenancy (records Domain Event and maps integration Outbox)
    const commandId = crypto.randomUUID();
    const correlationId = crypto.randomUUID();

    await uow.runInTransaction(async (txManager) => {
      const txTenancyRepo = new TypeOrmTenancyRepository(txManager);
      const loadedTenancy = await txTenancyRepo.findById(tenancyId, txManager);

      loadedTenancy!.activate(handover, new Date().toISOString(), crypto.randomUUID());

      await txTenancyRepo.save(loadedTenancy!, {
        transactionalEntityManager: txManager,
        commandId,
        correlationId,
      });
    });

    // 6. Trigger Outbox Relay to publish to SNS
    const relayedCount = await outboxRelay.relayPendingMessages();
    expect(relayedCount).toBe(1);

    // Give MiniStack SNS/SQS message broker half a second to route the message into SQS Sorter
    await new Promise((resolve) => setTimeout(resolve, 800));

    // 7. Trigger SQS Inbox Consumer to process the message and project TenancyAccessSnapshot to DynamoDB
    const processedCount = await inboxConsumer.pollAndProcess();
    expect(processedCount).toBeGreaterThan(0);

    // 8. Open Maintenance Request Use Case (Anti-Corruption Layer lookup verifies access successfully!)
    const requestId = crypto.randomUUID();
    const openRes = await openRequestUseCase.execute(
      new OpenRequestCommand(requestId, unitId, tenantId, 'Leaking water valve pipe break flood'),
    );

    expect(openRes.id).toBe(requestId);
    expect(openRes.status).toBe('OPENED');
    expect(openRes.isEmergency).toBe(true);

    // 9. Negative authorization check: any foreign user without access is securely rejected!
    const foreignTenantId = crypto.randomUUID();
    await expect(
      openRequestUseCase.execute(
        new OpenRequestCommand(crypto.randomUUID(), unitId, foreignTenantId, 'Leaking valve'),
      ),
    ).rejects.toThrow(ActiveTenancyRequiredError);
  });
});
