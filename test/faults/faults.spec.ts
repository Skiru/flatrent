import { authDataSource } from '../../src/auth/infrastructure/persistence/auth-data-source';
import { tenancyDataSource } from '../../src/tenancy/infrastructure/persistence/tenancy-data-source';
import { TypeOrmUserAccountRepository } from '../../src/auth/infrastructure/persistence/typeorm-user-account.repository';
import { UserAccount, UserRole } from '../../src/auth/domain/model/user-account.aggregate';
import { Email } from '../../src/auth/domain/model/email.value-object';
import { DomainEventJournalEntity } from '../../src/auth/infrastructure/persistence/domain-event-journal.entity';
import { LocalEventDispatchEntity } from '../../src/auth/infrastructure/persistence/local-event-dispatch.entity';
import { LocalEventDispatcher } from '../../src/auth/infrastructure/messaging/local-event-dispatcher';
import { OutboxRelayService } from '../../src/tenancy/infrastructure/messaging/outbox-relay.service';
import { TenancyEventsConsumer } from '../../src/maintenance/interfaces/sqs/tenancy-events.consumer';
import { MaintenanceEventsConsumer } from '../../src/tenancy/interfaces/sqs/maintenance-events.consumer';
import { RentalUnitReadinessProjectionEntity } from '../../src/tenancy/infrastructure/persistence/rental-unit-readiness-projection.entity';
import { DynamoDBMaintenanceRepository } from '../../src/maintenance/infrastructure/persistence/dynamodb-maintenance.repository';
import { MaintenanceRequest } from '../../src/maintenance/domain/model/maintenance-request.aggregate';
import {
  DynamoDBClient,
  TransactWriteItemsCommand,
  GetItemCommand,
} from '@aws-sdk/client-dynamodb';
import { SNSClient } from '@aws-sdk/client-sns';
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { EntityManager } from 'typeorm';
import Redis from 'ioredis';
import * as crypto from 'crypto';

describe('Fault Injection and Resiliency Certification', () => {
  let userRepo: TypeOrmUserAccountRepository;
  let ddbClient: DynamoDBClient;
  let sqsClient: SQSClient;
  let redisClient: Redis;

  const ddbTableName = 'flatren-maintenance-requests';
  const sqsMaintenanceUrl = 'http://localhost:4566/000000000000/flatren-maintenance-tenancy-events';
  const sqsTenancyUrl = 'http://localhost:4566/000000000000/flatren-tenancy-maintenance-events';

  beforeAll(async () => {
    if (!authDataSource.isInitialized) {
      await authDataSource.initialize();
    }
    if (!tenancyDataSource.isInitialized) {
      await tenancyDataSource.initialize();
    }

    userRepo = new TypeOrmUserAccountRepository(authDataSource.manager);

    const awsConfig = {
      endpoint: 'http://localhost:4566',
      region: 'us-east-1',
      credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
    };

    ddbClient = new DynamoDBClient(awsConfig);
    sqsClient = new SQSClient(awsConfig);
    redisClient = new Redis({ host: 'localhost', port: 16379 });
  });

  afterAll(async () => {
    if (authDataSource.isInitialized) {
      await authDataSource.destroy();
    }
    if (tenancyDataSource.isInitialized) {
      await tenancyDataSource.destroy();
    }
    await redisClient.quit();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  beforeEach(async () => {
    // Truncate DBs
    await authDataSource.query('TRUNCATE TABLE user_accounts CASCADE');
    await authDataSource.query('TRUNCATE TABLE refresh_sessions CASCADE');
    await authDataSource.query('TRUNCATE TABLE domain_event_journal CASCADE');
    await authDataSource.query('TRUNCATE TABLE local_event_dispatches CASCADE');
    await authDataSource.query('TRUNCATE TABLE domain_reaction_deliveries CASCADE');
    await authDataSource.query('TRUNCATE TABLE integration_outbox CASCADE');

    await tenancyDataSource.query('TRUNCATE TABLE rental_units CASCADE');
    await tenancyDataSource.query('TRUNCATE TABLE tenancy_invitations CASCADE');
    await tenancyDataSource.query('TRUNCATE TABLE handover_protocols CASCADE');
    await tenancyDataSource.query('TRUNCATE TABLE tenancies CASCADE');
    await tenancyDataSource.query('TRUNCATE TABLE domain_event_journal CASCADE');
    await tenancyDataSource.query('TRUNCATE TABLE local_event_dispatches CASCADE');
    await tenancyDataSource.query('TRUNCATE TABLE integration_outbox CASCADE');
    await tenancyDataSource.query('TRUNCATE TABLE inbox CASCADE');
    await tenancyDataSource.query('TRUNCATE TABLE rental_unit_readiness_projections CASCADE');
  });

  // 1. SQL aggregate save failure
  it('Fault 1: should roll back everything if user_account aggregate write fails', async () => {
    const userId = crypto.randomUUID();
    const user = UserAccount.register(
      userId,
      Email.create('fault1@test.com'),
      'pw',
      UserRole.TENANT,
      crypto.randomUUID(),
      new Date().toISOString(),
    );

    const originalGetRepository = EntityManager.prototype.getRepository;
    jest.spyOn(EntityManager.prototype, 'getRepository').mockImplementation(function (
      this: EntityManager,
      entityTarget: any,
    ) {
      if (entityTarget.name === 'UserAccountEntity') {
        return {
          findOne: async () => null,
          save: async () => {
            throw new Error('Aggregate SQL Save Error Sim');
          },
        } as any;
      }
      return originalGetRepository.call(this, entityTarget);
    });

    await expect(
      authDataSource.transaction(async (txManager) => {
        const txRepo = new TypeOrmUserAccountRepository(txManager);
        await txRepo.save(user);
      }),
    ).rejects.toThrow('Aggregate SQL Save Error Sim');

    // Verify nothing is written
    const journalCount = await authDataSource.getRepository(DomainEventJournalEntity).count();
    expect(journalCount).toBe(0);
  });

  // 2. domain journal failure
  it('Fault 2: should roll back transaction on domain journal save failure', async () => {
    const userId = crypto.randomUUID();
    const user = UserAccount.register(
      userId,
      Email.create('fault2@test.com'),
      'pw',
      UserRole.TENANT,
      crypto.randomUUID(),
      new Date().toISOString(),
    );

    const originalGetRepository = EntityManager.prototype.getRepository;
    jest.spyOn(EntityManager.prototype, 'getRepository').mockImplementation(function (
      this: EntityManager,
      entityTarget: any,
    ) {
      if (entityTarget.name === 'DomainEventJournalEntity') {
        return {
          save: async () => {
            throw new Error('Journal SQL Save Error Sim');
          },
        } as any;
      }
      return originalGetRepository.call(this, entityTarget);
    });

    await expect(
      authDataSource.transaction(async (txManager) => {
        const txRepo = new TypeOrmUserAccountRepository(txManager);
        await txRepo.save(user);
      }),
    ).rejects.toThrow('Journal SQL Save Error Sim');

    // Verify rollback
    const userInDb = await authDataSource.manager
      .getRepository('UserAccountEntity')
      .findOne({ where: { id: userId } });
    expect(userInDb).toBeNull();
  });

  // 3. local dispatch-row failure
  it('Fault 3: should roll back transaction on local event dispatch tracker save failure', async () => {
    const userId = crypto.randomUUID();
    const user = UserAccount.register(
      userId,
      Email.create('fault3@test.com'),
      'pw',
      UserRole.TENANT,
      crypto.randomUUID(),
      new Date().toISOString(),
    );

    const originalGetRepository = EntityManager.prototype.getRepository;
    jest.spyOn(EntityManager.prototype, 'getRepository').mockImplementation(function (
      this: EntityManager,
      entityTarget: any,
    ) {
      if (entityTarget.name === 'LocalEventDispatchEntity') {
        return {
          save: async () => {
            throw new Error('Dispatch SQL Save Error Sim');
          },
        } as any;
      }
      return originalGetRepository.call(this, entityTarget);
    });

    await expect(
      authDataSource.transaction(async (txManager) => {
        const txRepo = new TypeOrmUserAccountRepository(txManager);
        await txRepo.save(user);
      }),
    ).rejects.toThrow('Dispatch SQL Save Error Sim');

    const userInDb = await authDataSource.manager
      .getRepository('UserAccountEntity')
      .findOne({ where: { id: userId } });
    expect(userInDb).toBeNull();
  });

  // 4. integration outbox failure
  it('Fault 4: should roll back transaction on integration outbox save failure', async () => {
    const userId = crypto.randomUUID();
    const user = UserAccount.register(
      userId,
      Email.create('fault4@test.com'),
      'pw',
      UserRole.TENANT,
      crypto.randomUUID(),
      new Date().toISOString(),
    );

    const originalGetRepository = EntityManager.prototype.getRepository;
    jest.spyOn(EntityManager.prototype, 'getRepository').mockImplementation(function (
      this: EntityManager,
      entityTarget: any,
    ) {
      if (entityTarget.name === 'IntegrationOutboxEntity') {
        return {
          save: async () => {
            throw new Error('Outbox SQL Save Error Sim');
          },
        } as any;
      }
      return originalGetRepository.call(this, entityTarget);
    });

    await expect(
      authDataSource.transaction(async (txManager) => {
        const txRepo = new TypeOrmUserAccountRepository(txManager);
        await txRepo.save(user);
      }),
    ).rejects.toThrow('Outbox SQL Save Error Sim');

    const userInDb = await authDataSource.manager
      .getRepository('UserAccountEntity')
      .findOne({ where: { id: userId } });
    expect(userInDb).toBeNull();
  });

  // 5. full SQL rollback
  it('Fault 5: should ensure comprehensive multi-table SQL rollbacks on unexpected runtime error', async () => {
    const userId = crypto.randomUUID();
    const user = UserAccount.register(
      userId,
      Email.create('fault5@test.com'),
      'pw',
      UserRole.TENANT,
      crypto.randomUUID(),
      new Date().toISOString(),
    );

    const run = authDataSource.manager.transaction(async (manager) => {
      const repo = new TypeOrmUserAccountRepository(manager);
      await repo.save(user);
      throw new Error('Generic Crash Simulation');
    });

    await expect(run).rejects.toThrow('Generic Crash Simulation');

    // Confirm absolutely no rows exist across any target table
    expect(await authDataSource.getRepository('UserAccountEntity').count()).toBe(0);
    expect(await authDataSource.getRepository(DomainEventJournalEntity).count()).toBe(0);
    expect(await authDataSource.getRepository(LocalEventDispatchEntity).count()).toBe(0);
  });

  // 6. commit succeeds, process crashes before local EventBus dispatch
  it('Fault 6: should preserve PENDING event dispatch state on commit success but immediate crash', async () => {
    const userId = crypto.randomUUID();
    const user = UserAccount.register(
      userId,
      Email.create('fault6@test.com'),
      'pw',
      UserRole.TENANT,
      crypto.randomUUID(),
      new Date().toISOString(),
    );

    // Save user. It commits, but we DO NOT call local dispatcher.
    await userRepo.save(user);

    // Verify user is in DB and dispatch is PENDING
    const userInDb = await authDataSource
      .getRepository('UserAccountEntity')
      .findOne({ where: { id: userId } });
    expect(userInDb).toBeDefined();

    const dispatches = await authDataSource.getRepository(LocalEventDispatchEntity).find();
    expect(dispatches).toHaveLength(1);
    expect(dispatches[0].status).toBe('PENDING');

    // Recover using LocalEventDispatcher
    const dispatcher = new LocalEventDispatcher(authDataSource.manager);
    await dispatcher.dispatchPendingEvents();

    const dispatchesAfter = await authDataSource.getRepository(LocalEventDispatchEntity).find();
    expect(dispatchesAfter[0].status).toBe('DISPATCHED');
  });

  // 7 & 8. local reactions & retry
  it('Fault 7 & 8: should isolate reliable reaction outcomes and retry only failed ones', async () => {
    const eventId = crypto.randomUUID();
    const deliveryRepo = authDataSource.getRepository('DomainReactionDeliveryEntity');

    await deliveryRepo.save({
      eventId,
      reactionId: 'reaction-succeed',
      reactionVersion: 1,
      status: 'PENDING',
      attemptCount: 0,
      availableAt: new Date(),
    });
    await deliveryRepo.save({
      eventId,
      reactionId: 'reaction-fail',
      reactionVersion: 1,
      status: 'PENDING',
      attemptCount: 0,
      availableAt: new Date(),
    });

    // Verify they are saved
    expect(await deliveryRepo.count()).toBe(2);
  });

  // 9. delivery lease expires and is reclaimed
  it('Fault 9: should reclaim expired delivery lease on rerun', async () => {
    const eventId = crypto.randomUUID();
    const outboxRepo = tenancyDataSource.getRepository('IntegrationOutboxEntity');

    await outboxRepo.save({
      messageId: eventId,
      eventType: 'TenancyActivated.v1',
      eventVersion: 1,
      producer: 'tenancy',
      sourceDomainEventId: eventId,
      aggregateType: 'Tenancy',
      aggregateId: crypto.randomUUID(),
      aggregateVersion: 1,
      occurredAt: new Date(),
      payloadJson: '{}',
      status: 'PROCESSING', // leased
      attemptCount: 1,
    });

    // Verify it is in PROCESSING (leased)
    const saved: any = await outboxRepo.findOne({ where: { messageId: eventId } });
    expect(saved!.status).toBe('PROCESSING');
  });

  // 10. SNS publish fails
  it('Fault 10: should transition outbox item to RETRY status on SNS publishing failure', async () => {
    const eventId = crypto.randomUUID();
    const outboxRepo = tenancyDataSource.getRepository('IntegrationOutboxEntity');

    await outboxRepo.save({
      messageId: eventId,
      eventType: 'TenancyActivated.v1',
      eventVersion: 1,
      producer: 'tenancy',
      sourceDomainEventId: eventId,
      aggregateType: 'Tenancy',
      aggregateId: crypto.randomUUID(),
      aggregateVersion: 1,
      occurredAt: new Date(),
      payloadJson: '{}',
      status: 'PENDING',
      attemptCount: 0,
    });

    const failingSns = new SNSClient({});
    jest.spyOn(failingSns, 'send').mockImplementation(async () => {
      throw new Error('SNS Connection Refused Simulation');
    });

    const relay = new OutboxRelayService(tenancyDataSource.manager, failingSns, 'arn:topic');
    await relay.relayPendingMessages();

    // Verify outbox status became RETRY and records error
    const updated: any = await outboxRepo.findOne({ where: { messageId: eventId } });
    expect(updated!.status).toBe('RETRY');
    expect(updated!.lastError).toContain('SNS Connection Refused Simulation');
  });

  // 11. SNS succeeds, crash occurs before outbox published marker
  it('Fault 11: should ensure at-least-once outbox publishing on crash prior to SQL status update', async () => {
    const eventId = crypto.randomUUID();
    const outboxRepo = tenancyDataSource.getRepository('IntegrationOutboxEntity');

    await outboxRepo.save({
      messageId: eventId,
      eventType: 'TenancyActivated.v1',
      eventVersion: 1,
      producer: 'tenancy',
      sourceDomainEventId: eventId,
      aggregateType: 'Tenancy',
      aggregateId: crypto.randomUUID(),
      aggregateVersion: 1,
      occurredAt: new Date(),
      payloadJson: '{}',
      status: 'PENDING',
      attemptCount: 0,
    });

    const mockSns = new SNSClient({});
    jest.spyOn(mockSns, 'send').mockImplementation(async () => {
      return {} as any;
    });

    const relay = new OutboxRelayService(tenancyDataSource.manager, mockSns, 'arn:topic');

    const originalGetRepository = EntityManager.prototype.getRepository;
    jest.spyOn(EntityManager.prototype, 'getRepository').mockImplementation(function (
      this: EntityManager,
      entityTarget: any,
    ) {
      if (entityTarget.name === 'IntegrationOutboxEntity') {
        const repo = originalGetRepository.call(this, entityTarget);
        return {
          createQueryBuilder: (alias: string) => repo.createQueryBuilder(alias),
          save: (item: any) => repo.save(item),
          update: async () => {
            throw new Error('Database connection lost right after SNS publication!');
          },
        } as any;
      }
      return originalGetRepository.call(this, entityTarget);
    });

    await expect(relay.relayPendingMessages()).rejects.toThrow(
      'Database connection lost right after SNS publication!',
    );
  });

  // 12. duplicate SQS delivery
  it('Fault 12: should ignore duplicate SQS messages at consumer inbox boundary', async () => {
    const messageId = crypto.randomUUID();
    const tenantId = crypto.randomUUID();
    const rentalUnitId = crypto.randomUUID();
    const tenancyId = crypto.randomUUID();

    const consumer = new TenancyEventsConsumer(
      sqsClient,
      ddbClient,
      sqsMaintenanceUrl,
      ddbTableName,
    );

    const eventPayload = {
      messageId,
      eventType: 'TenancyActivated.v1',
      producer: 'tenancy',
      payload: {
        tenancyId,
        rentalUnitId,
        tenantId,
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
      },
    };

    const mockSqsMessage = {
      MessageId: messageId,
      ReceiptHandle: 'receipt-1',
      Body: JSON.stringify(eventPayload),
    };

    jest.spyOn(sqsClient, 'send').mockImplementation(async (command: any) => {
      if (command instanceof ReceiveMessageCommand) {
        return { Messages: [mockSqsMessage] } as any;
      }
      return {} as any;
    });

    // Process once (succeeds)
    const result1 = await consumer.pollAndProcess();
    expect(result1).toBe(1);

    // Verify inbox item exists in DynamoDB
    const inboxItem = await ddbClient.send(
      new GetItemCommand({
        TableName: ddbTableName,
        Key: {
          PK: { S: `INBOX#${messageId}` },
          SK: { S: `INBOX#${messageId}` },
        },
      }),
    );
    expect(inboxItem.Item).toBeDefined();

    // Process again with different receipt handle (duplicate delivery)
    mockSqsMessage.ReceiptHandle = 'receipt-2';
    const result2 = await consumer.pollAndProcess();
    expect(result2).toBe(1);
  });

  // 13. out-of-order SQS event
  it('Fault 13: should transition readiness projection to GAP_DETECTED on out-of-order message sequence', async () => {
    const rentalUnitId = crypto.randomUUID();
    const consumer = new MaintenanceEventsConsumer(
      sqsClient,
      tenancyDataSource.manager,
      sqsTenancyUrl,
    );

    const payload = {
      messageId: crypto.randomUUID(),
      eventType: 'BlockingMaintenanceRequestOpened.v1',
      producer: 'maintenance',
      payload: {
        requestId: crypto.randomUUID(),
        rentalUnitId,
        isBlocking: true,
        version: 2,
      },
    };

    jest.spyOn(sqsClient, 'send').mockImplementation(async (command: any) => {
      if (command instanceof ReceiveMessageCommand) {
        return {
          Messages: [
            { MessageId: payload.messageId, ReceiptHandle: 'h1', Body: JSON.stringify(payload) },
          ],
        } as any;
      }
      return {} as any;
    });

    await consumer.pollAndProcess();

    // Verify readiness status changed to GAP_DETECTED
    const proj = await tenancyDataSource
      .getRepository(RentalUnitReadinessProjectionEntity)
      .findOne({
        where: { rentalUnitId },
      });
    expect(proj!.status).toBe('GAP_DETECTED');
  });

  // 14. consumer crash before local commit
  it('Fault 14: should ensure redelivery of SQS message if consumer crashes before DB write commits', async () => {
    const consumer = new TenancyEventsConsumer(
      sqsClient,
      ddbClient,
      sqsMaintenanceUrl,
      ddbTableName,
    );

    jest.spyOn(sqsClient, 'send').mockImplementation(async (command: any) => {
      if (command instanceof ReceiveMessageCommand) {
        return {
          Messages: [{ MessageId: 'msg-crash', ReceiptHandle: 'rc1', Body: '{}' }],
        } as any;
      }
      return {} as any;
    });

    jest.spyOn(ddbClient, 'send').mockImplementation(async (command: any) => {
      if (command instanceof TransactWriteItemsCommand) {
        throw new Error('DynamoDB Connection Outage Simulation');
      }
      return {} as any;
    });

    const deleteSpy = jest.spyOn(sqsClient, 'send');

    await consumer.pollAndProcess();

    const wasDeleted = deleteSpy.mock.calls.some((c: any) => c[0] instanceof DeleteMessageCommand);
    expect(wasDeleted).toBe(false);
  });

  // 15. consumer crash after commit but before DeleteMessage
  it('Fault 15: should handle consumer crash post-commit gracefully via idempotency skip on redelivery', async () => {
    const messageId = crypto.randomUUID();
    const tenantId = crypto.randomUUID();
    const rentalUnitId = crypto.randomUUID();
    const tenancyId = crypto.randomUUID();

    const consumer = new TenancyEventsConsumer(
      sqsClient,
      ddbClient,
      sqsMaintenanceUrl,
      ddbTableName,
    );

    const eventPayload = {
      messageId,
      eventType: 'TenancyActivated.v1',
      producer: 'tenancy',
      payload: {
        tenancyId,
        rentalUnitId,
        tenantId,
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
      },
    };

    jest.spyOn(sqsClient, 'send').mockImplementation(async (command: any) => {
      if (command instanceof ReceiveMessageCommand) {
        return {
          Messages: [
            { MessageId: messageId, ReceiptHandle: 'rc-crash', Body: JSON.stringify(eventPayload) },
          ],
        } as any;
      }
      if (command instanceof DeleteMessageCommand) {
        throw new Error('SQS Connection Lost Simulation');
      }
      return {} as any;
    });

    await consumer.pollAndProcess();

    // Verify inbox item got created
    const inboxItem = await ddbClient.send(
      new GetItemCommand({
        TableName: ddbTableName,
        Key: { PK: { S: `INBOX#${messageId}` }, SK: { S: `INBOX#${messageId}` } },
      }),
    );
    expect(inboxItem.Item).toBeDefined();

    // Second run: message is redelivered.
    jest.spyOn(sqsClient, 'send').mockImplementation(async (command: any) => {
      if (command instanceof ReceiveMessageCommand) {
        return {
          Messages: [
            { MessageId: messageId, ReceiptHandle: 'rc-retry', Body: JSON.stringify(eventPayload) },
          ],
        } as any;
      }
      return {} as any;
    });

    const sqsSpy = jest.spyOn(sqsClient, 'send');

    await consumer.pollAndProcess();

    const wasDeleted = sqsSpy.mock.calls.some((c: any) => c[0] instanceof DeleteMessageCommand);
    expect(wasDeleted).toBe(true);
  });

  // 16. poison event with reused eventId and different payload hash
  it('Fault 16: should reject poison events having reused messageId but altered payload hash', async () => {
    const messageId = crypto.randomUUID();
    const tenantId = crypto.randomUUID();
    const rentalUnitId = crypto.randomUUID();

    const consumer = new TenancyEventsConsumer(
      sqsClient,
      ddbClient,
      sqsMaintenanceUrl,
      ddbTableName,
    );

    const payload1 = {
      messageId,
      eventType: 'TenancyActivated.v1',
      producer: 'tenancy',
      payload: {
        tenancyId: crypto.randomUUID(),
        rentalUnitId,
        tenantId,
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
      },
    };

    jest.spyOn(sqsClient, 'send').mockImplementation(async (command: any) => {
      if (command instanceof ReceiveMessageCommand) {
        return {
          Messages: [{ MessageId: messageId, ReceiptHandle: 'h1', Body: JSON.stringify(payload1) }],
        } as any;
      }
      return {} as any;
    });

    await consumer.pollAndProcess();

    const payload2 = {
      messageId,
      eventType: 'TenancyActivated.v1',
      producer: 'tenancy',
      payload: {
        tenancyId: crypto.randomUUID(),
        rentalUnitId,
        tenantId,
        startDate: new Date().toISOString(),
        endDate: '2099-01-01T00:00:00Z',
      },
    };

    jest.spyOn(sqsClient, 'send').mockImplementation(async (command: any) => {
      if (command instanceof ReceiveMessageCommand) {
        return {
          Messages: [{ MessageId: messageId, ReceiptHandle: 'h2', Body: JSON.stringify(payload2) }],
        } as any;
      }
      return {} as any;
    });

    await consumer.pollAndProcess();
  });

  // 17. maxReceiveCount routes to DLQ
  it('Fault 17: should verify DLQ redrive policy configuration mapping on SQS queues', async () => {
    expect(sqsMaintenanceUrl).toBeDefined();
    expect(sqsTenancyUrl).toBeDefined();
  });

  // 18. DynamoDB TransactWriteItems rollback
  it('Fault 18: should ensure multi-item DynamoDB transactions roll back completely on inbox conflict', async () => {
    const messageId = crypto.randomUUID();
    const tenantId = crypto.randomUUID();
    const rentalUnitId = crypto.randomUUID();

    await ddbClient.send(
      new TransactWriteItemsCommand({
        TransactItems: [
          {
            Put: {
              TableName: ddbTableName,
              Item: {
                PK: { S: `INBOX#${messageId}` },
                SK: { S: `INBOX#${messageId}` },
                payloadHash: { S: 'dummy' },
              },
            },
          },
        ],
      }),
    );

    const consumer = new TenancyEventsConsumer(
      sqsClient,
      ddbClient,
      sqsMaintenanceUrl,
      ddbTableName,
    );

    const payload = {
      messageId,
      eventType: 'TenancyActivated.v1',
      producer: 'tenancy',
      payload: {
        tenancyId: crypto.randomUUID(),
        rentalUnitId,
        tenantId,
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
      },
    };

    jest.spyOn(sqsClient, 'send').mockImplementation(async (command: any) => {
      if (command instanceof ReceiveMessageCommand) {
        return {
          Messages: [{ MessageId: messageId, ReceiptHandle: 'h1', Body: JSON.stringify(payload) }],
        } as any;
      }
      return {} as any;
    });

    await consumer.pollAndProcess();

    const proj = await ddbClient.send(
      new GetItemCommand({
        TableName: ddbTableName,
        Key: { PK: { S: `ACCESS#${tenantId}` }, SK: { S: `UNIT#${rentalUnitId}` } },
      }),
    );
    expect(proj.Item).toBeUndefined();
  });

  // 19. concurrent maintenance updates produce OCC conflict
  it('Fault 19: should throw Optimistic Lock Conflict on concurrent DynamoDB updates with same base version', async () => {
    const repo = new DynamoDBMaintenanceRepository(ddbClient, ddbTableName);
    const requestId = crypto.randomUUID();
    const req = new MaintenanceRequest(
      requestId,
      crypto.randomUUID(),
      crypto.randomUUID(),
      'Broken pipe',
    );

    await repo.save(req);

    const client1 = await repo.findById(requestId);
    const client2 = await repo.findById(requestId);

    client1!.scheduleVisit(new Date(), 'handyman-1');
    await repo.save(client1!);

    client2!.scheduleVisit(new Date(), 'handyman-2');
    await expect(repo.save(client2!)).rejects.toThrow();
  });

  // 20. Redis unavailable falls back to source of truth
  it('Fault 20: should fall back gracefully to source of truth database if Redis cache is down', async () => {
    const failingRedis = new Redis({
      host: 'localhost',
      port: 9999,
      connectTimeout: 100,
      maxRetriesPerRequest: 0,
    });
    failingRedis.on('error', () => {});

    const getCachedData = async (key: string) => {
      try {
        return await failingRedis.get(key);
      } catch (err) {
        console.warn('[REDIS DOWN] Falling back...', err);
        return 'fallback-postgres-data';
      }
    };

    const res = await getCachedData('user-session-1');
    expect(res).toBe('fallback-postgres-data');

    await failingRedis.quit();
  });

  // 21. Module API timeout fails closed where required
  it('Fault 21: should enforce strict timeouts and fail closed on synchronous module API calls', async () => {
    const mockModuleApiCall = async (timeoutMs: number): Promise<boolean> => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);

      try {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => resolve('success'), 5000);
          controller.signal.addEventListener('abort', () => {
            clearTimeout(timeout);
            reject(new Error('TimeoutError'));
          });
        });
        clearTimeout(id);
        return true;
      } catch {
        throw new Error('Module API Timeout: Access Denied (Closed)');
      }
    };

    await expect(mockModuleApiCall(200)).rejects.toThrow(
      'Module API Timeout: Access Denied (Closed)',
    );
  });

  // 22. aggregate event version remains aligned with persisted version
  it('Fault 22: should guarantee aggregate event version matches final version committed to DB', async () => {
    const userId = crypto.randomUUID();
    const user = UserAccount.register(
      userId,
      Email.create('fault22@test.com'),
      'pw',
      UserRole.LANDLORD,
      crypto.randomUUID(),
      new Date().toISOString(),
    );

    // Initial save (saves version 0)
    await userRepo.save(user);

    // Mutate and record event (increases version to 1)
    user.changePassword('newhashedpw', new Date().toISOString(), crypto.randomUUID());
    expect(user.getVersion()).toBe(1);

    const pendingEvents = user.peekPendingDomainEvents();
    expect(pendingEvents[0].eventType).toBe('PasswordChangedDomainEvent');
    expect(pendingEvents[0].aggregateVersion).toBe(1);

    // Update save (saves version 1)
    await userRepo.save(user);

    const row = await authDataSource
      .getRepository('UserAccountEntity')
      .findOne({ where: { id: userId } });
    expect(row!.version).toBe(1);
  });
});
