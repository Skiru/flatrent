import { tenancyDataSource } from '../../src/tenancy/infrastructure/persistence/tenancy-data-source';
import { TypeOrmRentalUnitRepository } from '../../src/tenancy/infrastructure/persistence/typeorm-rental-unit.repository';
import { TypeOrmTenancyInvitationRepository } from '../../src/tenancy/infrastructure/persistence/typeorm-tenancy-invitation.repository';
import { TypeOrmHandoverProtocolRepository } from '../../src/tenancy/infrastructure/persistence/typeorm-handover-protocol.repository';
import { TypeOrmTenancyRepository } from '../../src/tenancy/infrastructure/persistence/typeorm-tenancy.repository';
import { TypeOrmUnitOfWork } from '../../src/tenancy/infrastructure/persistence/typeorm-unit-of-work';
import { RentalUnit } from '../../src/tenancy/domain/model/rental-unit.aggregate';
import { TenancyInvitation } from '../../src/tenancy/domain/model/tenancy-invitation.aggregate';
import { HandoverProtocol } from '../../src/tenancy/domain/model/handover-protocol.aggregate';
import { Tenancy, TenancyStatus } from '../../src/tenancy/domain/model/tenancy.aggregate';
import { DomainEventJournalEntity } from '../../src/tenancy/infrastructure/persistence/domain-event-journal.entity';
import { LocalEventDispatchEntity } from '../../src/tenancy/infrastructure/persistence/local-event-dispatch.entity';
import { IntegrationOutboxEntity } from '../../src/tenancy/infrastructure/persistence/integration-outbox.entity';
import { LocalEventDispatcher } from '../../src/tenancy/infrastructure/messaging/local-event-dispatcher';
import * as crypto from 'crypto';

describe('Tenancy Context Database Integration Tests', () => {
  let unitRepo: TypeOrmRentalUnitRepository;
  let inviteRepo: TypeOrmTenancyInvitationRepository;
  let handoverRepo: TypeOrmHandoverProtocolRepository;
  let tenancyRepo: TypeOrmTenancyRepository;
  let uow: TypeOrmUnitOfWork;

  beforeAll(async () => {
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
  });

  afterAll(async () => {
    if (tenancyDataSource.isInitialized) {
      await tenancyDataSource.destroy();
    }
  });

  beforeEach(async () => {
    await tenancyDataSource.query('TRUNCATE TABLE rental_units CASCADE');
    await tenancyDataSource.query('TRUNCATE TABLE tenancy_invitations CASCADE');
    await tenancyDataSource.query('TRUNCATE TABLE handover_protocols CASCADE');
    await tenancyDataSource.query('TRUNCATE TABLE tenancies CASCADE');
    await tenancyDataSource.query('TRUNCATE TABLE domain_event_journal CASCADE');
    await tenancyDataSource.query('TRUNCATE TABLE local_event_dispatches CASCADE');
    await tenancyDataSource.query('TRUNCATE TABLE integration_outbox CASCADE');
  });

  it('should successfully map and save all Tenancy Context aggregates', async () => {
    const ownerId = crypto.randomUUID();
    const tenantId = crypto.randomUUID();
    const unitId = crypto.randomUUID();
    const inviteId = crypto.randomUUID();
    const handoverId = crypto.randomUUID();
    const tenancyId = crypto.randomUUID();

    // 1. Rental Unit
    const unit = new RentalUnit(unitId, ownerId, '456 Database Rd');
    await unitRepo.save(unit);
    const loadedUnit = await unitRepo.findById(unitId);
    expect(loadedUnit).toBeDefined();
    expect(loadedUnit!.getAddress()).toBe('456 Database Rd');

    // 2. Invitation
    const invite = new TenancyInvitation(
      inviteId,
      unitId,
      'invite@test.com',
      new Date(Date.now() + 10000),
    );
    await inviteRepo.save(invite);
    const loadedInvite = await inviteRepo.findById(inviteId);
    expect(loadedInvite).toBeDefined();
    expect(loadedInvite!.getTenantEmail()).toBe('invite@test.com');

    // 3. Handover Protocol
    const handover = new HandoverProtocol(handoverId, tenancyId);
    handover.recordMeterReading('gas', 450.2);
    handover.close();
    await handoverRepo.save(handover);
    const loadedHandover = await handoverRepo.findById(handoverId);
    expect(loadedHandover).toBeDefined();
    expect(loadedHandover!.getMeterReadings().gas).toBe(450.2);
    expect(loadedHandover!.getIsClosed()).toBe(true);

    // 4. Tenancy
    const tenancy = new Tenancy(tenancyId, unitId, tenantId, new Date(), new Date());
    await tenancyRepo.save(tenancy);
    const loadedTenancy = await tenancyRepo.findById(tenancyId);
    expect(loadedTenancy).toBeDefined();
    expect(loadedTenancy!.getStatus()).toBe(TenancyStatus.RESERVED);
  });

  it('should physically block overlapping tenancies at database layer via GIST exclusion constraint', async () => {
    const unitId = crypto.randomUUID();
    const landlordId = crypto.randomUUID();

    await unitRepo.save(new RentalUnit(unitId, landlordId, '456 Exclusion Rd'));

    const startDate = new Date('2026-08-01T00:00:00.000Z');
    const endDate = new Date('2026-08-31T23:59:59.000Z');

    const tenancy1 = new Tenancy(
      crypto.randomUUID(),
      unitId,
      crypto.randomUUID(),
      startDate,
      endDate,
      TenancyStatus.ACTIVE,
    );
    await tenancyRepo.save(tenancy1);

    // Attempting to save an overlapping active tenancy for same unit must violate exclusion constraint!
    const overlapStartDate = new Date('2026-08-15T00:00:00.000Z');
    const overlapEndDate = new Date('2026-09-15T23:59:59.000Z');
    const tenancy2 = new Tenancy(
      crypto.randomUUID(),
      unitId,
      crypto.randomUUID(),
      overlapStartDate,
      overlapEndDate,
      TenancyStatus.ACTIVE,
    );

    // DB throws a query violation error (exclusion constraint)
    await expect(tenancyRepo.save(tenancy2)).rejects.toThrow();
  });

  it('should atomically record tenancy activations, journals, dispatches, and public integration outbox', async () => {
    const unitId = crypto.randomUUID();
    const tenantId = crypto.randomUUID();
    const tenancyId = crypto.randomUUID();
    const handoverId = crypto.randomUUID();

    const tenancy = new Tenancy(tenancyId, unitId, tenantId, new Date(), new Date());
    await tenancyRepo.save(tenancy);

    const handover = new HandoverProtocol(handoverId, tenancyId);
    handover.close();
    await handoverRepo.save(handover);

    // Load and Activate tenancy (which records TenancyActivatedDomainEvent)
    const activeTenancy = await tenancyRepo.findById(tenancyId);
    activeTenancy!.activate(handover, new Date().toISOString(), crypto.randomUUID());

    const commandId = crypto.randomUUID();
    const correlationId = crypto.randomUUID();

    // Save with transactional context
    await uow.runInTransaction(async (txManager) => {
      const txTenancyRepo = new TypeOrmTenancyRepository(txManager);
      await txTenancyRepo.save(activeTenancy!, {
        transactionalEntityManager: txManager,
        commandId,
        correlationId,
      });
    });

    // Verify DB states
    const journal = await tenancyDataSource.getRepository(DomainEventJournalEntity).find();
    expect(journal.length).toBe(1);
    expect(journal[0].eventType).toBe('TenancyActivatedDomainEvent');

    const dispatches = await tenancyDataSource.getRepository(LocalEventDispatchEntity).find();
    expect(dispatches.length).toBe(1);
    expect(dispatches[0].status).toBe('PENDING');

    const outbox = await tenancyDataSource.getRepository(IntegrationOutboxEntity).find();
    expect(outbox.length).toBe(1);
    expect(outbox[0].eventType).toBe('TenancyActivated.v1');
    expect(outbox[0].payloadJson).toContain('tenancyId');
  });

  it('should enforce Optimistic Concurrency Control (OCC) version checks on tenancy updates', async () => {
    const tenancyId = crypto.randomUUID();
    const tenancy = new Tenancy(
      tenancyId,
      crypto.randomUUID(),
      crypto.randomUUID(),
      new Date(),
      new Date(),
      TenancyStatus.ACTIVE,
    );
    await tenancyRepo.save(tenancy);

    const client1 = await tenancyRepo.findById(tenancyId);
    const client2 = await tenancyRepo.findById(tenancyId);

    client1!.giveNotice(new Date());
    await tenancyRepo.save(client1!); // DB version is now 1

    client2!.giveNotice(new Date());
    await expect(tenancyRepo.save(client2!)).rejects.toThrow('Optimistic Lock Conflict');
  });

  it('should process local post-commit dispatches cleanly on recovery worker trigger', async () => {
    const tenancyId = crypto.randomUUID();
    const dispatcher = new LocalEventDispatcher(tenancyDataSource.manager);

    const tenancy = new Tenancy(
      tenancyId,
      crypto.randomUUID(),
      crypto.randomUUID(),
      new Date(),
      new Date(),
    );
    await tenancyRepo.save(tenancy);

    const handover = new HandoverProtocol(crypto.randomUUID(), tenancyId);
    handover.close();
    await handoverRepo.save(handover);

    const activeTenancy = await tenancyRepo.findById(tenancyId);
    activeTenancy!.activate(handover, new Date().toISOString(), crypto.randomUUID());

    // Save with transaction, but no instant dispatch
    await uow.runInTransaction(async (txManager) => {
      const txTenancyRepo = new TypeOrmTenancyRepository(txManager);
      await txTenancyRepo.save(activeTenancy!, { transactionalEntityManager: txManager });
    });

    // Run recovery dispatcher
    await dispatcher.dispatchPendingEvents();

    const dispatches = await tenancyDataSource.getRepository(LocalEventDispatchEntity).find();
    expect(dispatches.length).toBe(1);
    expect(dispatches[0].status).toBe('DISPATCHED');
  });
});
