import { authDataSource } from '../../src/auth/infrastructure/persistence/auth-data-source';
import { TypeOrmUserAccountRepository } from '../../src/auth/infrastructure/persistence/typeorm-user-account.repository';
import { TypeOrmUnitOfWork } from '../../src/auth/infrastructure/persistence/typeorm-unit-of-work';
import { UserAccount, UserRole } from '../../src/auth/domain/model/user-account.aggregate';
import { Email } from '../../src/auth/domain/model/email.value-object';
import { DomainEventJournalEntity } from '../../src/auth/infrastructure/persistence/domain-event-journal.entity';
import { LocalEventDispatchEntity } from '../../src/auth/infrastructure/persistence/local-event-dispatch.entity';
import { IntegrationOutboxEntity } from '../../src/auth/infrastructure/persistence/integration-outbox.entity';
import { LocalEventDispatcher } from '../../src/auth/infrastructure/messaging/local-event-dispatcher';
import * as crypto from 'crypto';

describe('Auth Bounded Context Database Integration Tests', () => {
  let userRepo: TypeOrmUserAccountRepository;
  let uow: TypeOrmUnitOfWork;

  beforeAll(async () => {
    // 1. Initialize DataSource pointing to the live local MiniStack RDS
    if (!authDataSource.isInitialized) {
      await authDataSource.initialize();
    }

    // 2. Clear tables from potential previous runs to guarantee clean state
    await authDataSource.dropDatabase();
    await authDataSource.runMigrations();

    userRepo = new TypeOrmUserAccountRepository(authDataSource.manager);
    uow = new TypeOrmUnitOfWork(authDataSource.manager);
  });

  afterAll(async () => {
    if (authDataSource.isInitialized) {
      await authDataSource.destroy();
    }
  });

  beforeEach(async () => {
    // Truncate all tables before each test case
    await authDataSource.query('TRUNCATE TABLE user_accounts CASCADE');
    await authDataSource.query('TRUNCATE TABLE refresh_sessions CASCADE');
    await authDataSource.query('TRUNCATE TABLE domain_event_journal CASCADE');
    await authDataSource.query('TRUNCATE TABLE local_event_dispatches CASCADE');
    await authDataSource.query('TRUNCATE TABLE domain_reaction_deliveries CASCADE');
    await authDataSource.query('TRUNCATE TABLE integration_outbox CASCADE');
  });

  it('should successfully save and load UserAccount aggregate with all mappers and transaction scope', async () => {
    const userId = crypto.randomUUID();
    const email = Email.create('landlord@flatren.com');
    const user = UserAccount.register(
      userId,
      email,
      'passwordHash',
      UserRole.LANDLORD,
      crypto.randomUUID(),
      new Date().toISOString(),
    );

    // Save
    await userRepo.save(user);

    // Load
    const loaded = await userRepo.findById(userId);
    expect(loaded).toBeDefined();
    expect(loaded!.id).toBe(userId);
    expect(loaded!.getEmail().equals(email)).toBe(true);
    expect(loaded!.getRole()).toBe(UserRole.LANDLORD);
  });

  it('should atomically save User, Journal, Dispatches, and Outbox rows under same local transaction', async () => {
    const userId = crypto.randomUUID();
    const commandId = crypto.randomUUID();
    const correlationId = crypto.randomUUID();

    await uow.runInTransaction(async (txManager) => {
      const txUserRepo = new TypeOrmUserAccountRepository(txManager);
      const user = UserAccount.register(
        userId,
        Email.create('tenant@flatren.com'),
        'passwordHash',
        UserRole.TENANT,
        crypto.randomUUID(),
        new Date().toISOString(),
      );

      // Saves user and atomically serializes recorded events to Journal, Dispatches, and Outbox!
      await txUserRepo.save(user, {
        transactionalEntityManager: txManager,
        commandId,
        correlationId,
      });
    });

    // Verify all saved successfully
    const userExists = await userRepo.findById(userId);
    expect(userExists).toBeDefined();

    const journalEntries = await authDataSource.getRepository(DomainEventJournalEntity).find();
    expect(journalEntries.length).toBe(1);
    expect(journalEntries[0].commandId).toBe(commandId);
    expect(journalEntries[0].correlationId).toBe(correlationId);

    const dispatches = await authDataSource.getRepository(LocalEventDispatchEntity).find();
    expect(dispatches.length).toBe(1);
    expect(dispatches[0].status).toBe('PENDING');

    const outbox = await authDataSource.getRepository(IntegrationOutboxEntity).find();
    expect(outbox.length).toBe(1);
    expect(outbox[0].status).toBe('PENDING');
  });

  it('should roll back all writes if transaction callback fails, preserving integrity and leaving no orphans', async () => {
    const userId = crypto.randomUUID();

    const task = uow.runInTransaction(async (txManager) => {
      const txUserRepo = new TypeOrmUserAccountRepository(txManager);
      const user = UserAccount.register(
        userId,
        Email.create('fail@flatren.com'),
        'passwordHash',
        UserRole.TENANT,
        crypto.randomUUID(),
        new Date().toISOString(),
      );

      await txUserRepo.save(user, { transactionalEntityManager: txManager });

      // Intentionally raise an error to trigger rollback!
      throw new Error('Simulation of unexpected write error');
    });

    await expect(task).rejects.toThrow('Simulation of unexpected write error');

    // Prove nothing was written (all or nothing rollback!)
    const user = await userRepo.findById(userId);
    expect(user).toBeNull();

    const journals = await authDataSource.getRepository(DomainEventJournalEntity).find();
    expect(journals.length).toBe(0);

    const dispatches = await authDataSource.getRepository(LocalEventDispatchEntity).find();
    expect(dispatches.length).toBe(0);
  });

  it('should enforce Optimistic Concurrency Control (OCC) version increments and reject concurrent stale updates', async () => {
    const userId = crypto.randomUUID();
    const user = UserAccount.register(
      userId,
      Email.create('concurrency@flatren.com'),
      'pw',
      UserRole.LANDLORD,
      crypto.randomUUID(),
      new Date().toISOString(),
    );

    await userRepo.save(user); // Version in DB is now 0

    const client1User = await userRepo.findById(userId); // Loads version 0
    const client2User = await userRepo.findById(userId); // Loads version 0

    // Client 1 block/mutates user account first
    client1User!.block();
    await userRepo.save(client1User!); // Version in DB is now 1

    // Client 2 attempts to mutate stale version 0 and must fail due to OCC mismatch check
    client2User!.block();
    await expect(userRepo.save(client2User!)).rejects.toThrow();
  });

  it('should safely recover committed domain events on dispatcher crash-recovery run', async () => {
    const userId = crypto.randomUUID();
    const dispatcher = new LocalEventDispatcher(authDataSource.manager);

    // Save user account with domain events, but DO NOT run dispatcher yet
    await uow.runInTransaction(async (txManager) => {
      const txUserRepo = new TypeOrmUserAccountRepository(txManager);
      const user = UserAccount.register(
        userId,
        Email.create('crash-dispatch@flatren.com'),
        'pw',
        UserRole.TENANT,
        crypto.randomUUID(),
        new Date().toISOString(),
      );
      await txUserRepo.save(user, { transactionalEntityManager: txManager });
    });

    // At this point, the transaction successfully committed, but event remains undispatched (PENDING).
    // Let's invoke the dispatcher now (simulating crash-recovery startup run).
    await dispatcher.dispatchPendingEvents();

    const dispatches = await authDataSource.getRepository(LocalEventDispatchEntity).find();
    expect(dispatches.length).toBe(1);
    expect(dispatches[0].status).toBe('DISPATCHED');
  });
});
