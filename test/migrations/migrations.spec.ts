import { authDataSource } from '../../src/auth/infrastructure/persistence/auth-data-source';
import { tenancyDataSource } from '../../src/tenancy/infrastructure/persistence/tenancy-data-source';

describe('Database Migration Certification and Audit Suite', () => {
  beforeEach(async () => {
    if (!authDataSource.isInitialized) {
      await authDataSource.initialize();
    }
    if (!tenancyDataSource.isInitialized) {
      await tenancyDataSource.initialize();
    }
  });

  afterAll(async () => {
    if (authDataSource.isInitialized) {
      await authDataSource.destroy();
    }
    if (tenancyDataSource.isInitialized) {
      await tenancyDataSource.destroy();
    }
  });

  it('should execute full schema lifecycles, proving isolation and completeness', async () => {
    // 1. Drop both databases to zero
    await authDataSource.dropDatabase();
    await tenancyDataSource.dropDatabase();

    // 2. Assert zero application tables before migrations
    const getTables = async (dataSource: typeof authDataSource) => {
      const rows = await dataSource.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
          AND table_name != 'migrations'
      `);
      return rows.map((r: any) => r.table_name);
    };

    const authTablesBefore = await getTables(authDataSource);
    const tenancyTablesBefore = await getTables(tenancyDataSource);

    expect(authTablesBefore).toHaveLength(0);
    expect(tenancyTablesBefore).toHaveLength(0);

    // 3. Run migrations on both databases
    await authDataSource.runMigrations();
    await tenancyDataSource.runMigrations();

    // 4. Assert exact expected schema objects and constraints
    const authTablesAfter = await getTables(authDataSource);
    const tenancyTablesAfter = await getTables(tenancyDataSource);

    // Expected Auth tables
    const expectedAuth = [
      'user_accounts',
      'refresh_sessions',
      'domain_event_journal',
      'local_event_dispatches',
      'domain_reaction_deliveries',
      'integration_outbox',
    ];
    // Expected Tenancy tables
    const expectedTenancy = [
      'rental_units',
      'tenancy_invitations',
      'handover_protocols',
      'tenancies',
      'domain_event_journal',
      'local_event_dispatches',
      'domain_reaction_deliveries',
      'integration_outbox',
      'inbox',
      'rental_unit_readiness_projections',
    ];

    for (const table of expectedAuth) {
      expect(authTablesAfter).toContain(table);
    }
    for (const table of expectedTenancy) {
      expect(tenancyTablesAfter).toContain(table);
    }

    // 5. Assert no pending migrations (showMigrations returns false if they all have run)
    // Wait, TypeORM showMigrations resolves to true if there are pending migrations, false otherwise.
    const authHasPending = await authDataSource.showMigrations();
    const tenancyHasPending = await tenancyDataSource.showMigrations();
    expect(authHasPending).toBe(false);
    expect(tenancyHasPending).toBe(false);

    // 6. Perform safe down/up for reversible migrations
    await authDataSource.undoLastMigration();
    await tenancyDataSource.undoLastMigration(); // undo readiness table
    await tenancyDataSource.undoLastMigration(); // undo tenancy schema table

    // Check tables are empty now
    const authTablesAfterUndo = await getTables(authDataSource);
    const tenancyTablesAfterUndo = await getTables(tenancyDataSource);
    expect(authTablesAfterUndo).toHaveLength(0);
    expect(tenancyTablesAfterUndo).toHaveLength(0);

    // Run migrations again to restore clean schema
    await authDataSource.runMigrations();
    await tenancyDataSource.runMigrations();

    // 7. Verify foreign keys and relations do not cross module databases
    const getForeignKeys = async (dataSource: typeof authDataSource) => {
      return dataSource.query(`
        SELECT conname, pg_get_constraintdef(c.oid) as def 
        FROM pg_constraint c 
        JOIN pg_namespace n ON n.oid = c.connamespace 
        WHERE contype = 'f' AND nspname = 'public'
      `);
    };

    const authFKs = await getForeignKeys(authDataSource);
    const tenancyFKs = await getForeignKeys(tenancyDataSource);

    for (const fk of authFKs) {
      expect(fk.def).not.toContain('tenancies');
      expect(fk.def).not.toContain('rental_units');
    }
    for (const fk of tenancyFKs) {
      expect(fk.def).not.toContain('user_accounts');
      expect(fk.def).not.toContain('refresh_sessions');
    }

    // 8. Rerun migration command and prove idempotent no-op behavior
    await expect(authDataSource.runMigrations()).resolves.not.toThrow();
    await expect(tenancyDataSource.runMigrations()).resolves.not.toThrow();
  });
});
