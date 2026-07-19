import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTenancySchema1721382500000 implements MigrationInterface {
  public name = 'CreateTenancySchema1721382500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Enable btree_gist extension for exclusion constraints
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS btree_gist`);

    // 2. Rental Units Table
    await queryRunner.query(`
      CREATE TABLE "rental_units" (
        "id" UUID PRIMARY KEY,
        "owner_id" UUID NOT NULL,
        "address" VARCHAR(255) NOT NULL,
        "version" INT NOT NULL DEFAULT 0
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_rental_units_owner_id" ON "rental_units" ("owner_id")
    `);

    // 3. Tenancy Invitations Table
    await queryRunner.query(`
      CREATE TABLE "tenancy_invitations" (
        "id" UUID PRIMARY KEY,
        "rental_unit_id" UUID NOT NULL,
        "tenant_email" VARCHAR(255) NOT NULL,
        "expires_at" TIMESTAMP NOT NULL,
        "status" VARCHAR(50) NOT NULL,
        "version" INT NOT NULL DEFAULT 0
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_invitations_rental_unit_id" ON "tenancy_invitations" ("rental_unit_id")
    `);

    // 4. Handover Protocols Table
    await queryRunner.query(`
      CREATE TABLE "handover_protocols" (
        "id" UUID PRIMARY KEY,
        "tenancy_id" UUID NOT NULL,
        "meter_readings" JSONB NOT NULL DEFAULT '{}',
        "checklist" JSONB NOT NULL DEFAULT '{}',
        "is_closed" BOOLEAN NOT NULL DEFAULT false,
        "version" INT NOT NULL DEFAULT 0
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_handover_tenancy_id" ON "handover_protocols" ("tenancy_id")
    `);

    // 5. Tenancies Table (with race-safe date exclusion constraint!)
    await queryRunner.query(`
      CREATE TABLE "tenancies" (
        "id" UUID PRIMARY KEY,
        "rental_unit_id" UUID NOT NULL,
        "tenant_id" UUID NOT NULL,
        "start_date" TIMESTAMP NOT NULL,
        "end_date" TIMESTAMP NOT NULL,
        "status" VARCHAR(50) NOT NULL,
        "notice_date" TIMESTAMP,
        "version" INT NOT NULL DEFAULT 0
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_tenancies_rental_unit_id" ON "tenancies" ("rental_unit_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_tenancies_tenant_id" ON "tenancies" ("tenant_id")
    `);

    // Add physical, database-layer race-safe date exclusion guard!
    await queryRunner.query(`
      ALTER TABLE "tenancies" ADD CONSTRAINT "uq_tenancy_overlap_prevention"
      EXCLUDE USING gist (
        "rental_unit_id" WITH =,
        tsrange("start_date", "end_date", '[]') WITH &&
      )
      WHERE ("status" IN ('ACTIVE', 'RESERVED'))
    `);

    // 6. Domain Event Journal Table
    await queryRunner.query(`
      CREATE TABLE "domain_event_journal" (
        "event_id" UUID PRIMARY KEY,
        "commit_position" BIGSERIAL UNIQUE,
        "event_type" VARCHAR(255) NOT NULL,
        "event_version" INT NOT NULL,
        "module" VARCHAR(50) NOT NULL,
        "aggregate_type" VARCHAR(100) NOT NULL,
        "aggregate_id" UUID NOT NULL,
        "aggregate_version" INT NOT NULL,
        "event_index" INT NOT NULL,
        "occurred_at" TIMESTAMP NOT NULL,
        "committed_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "actor_id" UUID,
        "command_id" UUID NOT NULL,
        "correlation_id" UUID NOT NULL,
        "causation_id" UUID,
        "payload_json" TEXT NOT NULL,
        CONSTRAINT "uq_journal_event_ordering_tenancy" UNIQUE ("module", "aggregate_type", "aggregate_id", "aggregate_version", "event_index")
      )
    `);

    // 7. Local Event Dispatches Tracker
    await queryRunner.query(`
      CREATE TABLE "local_event_dispatches" (
        "event_id" UUID PRIMARY KEY,
        "status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        "attempt_count" INT NOT NULL DEFAULT 0,
        "available_at" TIMESTAMP NOT NULL,
        "dispatched_at" TIMESTAMP,
        "last_error" TEXT
      )
    `);

    // 8. Domain Reaction Deliveries Tracker
    await queryRunner.query(`
      CREATE TABLE "domain_reaction_deliveries" (
        "event_id" UUID NOT NULL,
        "reaction_id" VARCHAR(255) NOT NULL,
        "reaction_version" INT NOT NULL,
        "status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        "attempt_count" INT NOT NULL DEFAULT 0,
        "available_at" TIMESTAMP NOT NULL,
        "processed_at" TIMESTAMP,
        "last_error" TEXT,
        PRIMARY KEY ("event_id", "reaction_id", "reaction_version")
      )
    `);

    // 9. Integration Outbox Table
    await queryRunner.query(`
      CREATE TABLE "integration_outbox" (
        "message_id" UUID PRIMARY KEY,
        "event_type" VARCHAR(255) NOT NULL,
        "event_version" INT NOT NULL,
        "producer" VARCHAR(50) NOT NULL,
        "source_domain_event_id" UUID NOT NULL,
        "aggregate_type" VARCHAR(100) NOT NULL,
        "aggregate_id" UUID NOT NULL,
        "aggregate_version" INT NOT NULL,
        "occurred_at" TIMESTAMP NOT NULL,
        "payload_json" TEXT NOT NULL,
        "status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        "attempt_count" INT NOT NULL DEFAULT 0,
        "last_error" TEXT
      )
    `);

    // 10. Idempotent SQS Inbox Table
    await queryRunner.query(`
      CREATE TABLE "inbox" (
        "consumer_name" VARCHAR(100) NOT NULL,
        "message_id" UUID NOT NULL,
        "event_type" VARCHAR(255) NOT NULL,
        "event_version" INT NOT NULL,
        "payload_hash" VARCHAR(255) NOT NULL,
        "source_aggregate_id" UUID NOT NULL,
        "source_aggregate_version" INT NOT NULL,
        "status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        "received_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "processed_at" TIMESTAMP,
        PRIMARY KEY ("consumer_name", "message_id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "inbox"`);
    await queryRunner.query(`DROP TABLE "integration_outbox"`);
    await queryRunner.query(`DROP TABLE "domain_reaction_deliveries"`);
    await queryRunner.query(`DROP TABLE "local_event_dispatches"`);
    await queryRunner.query(`DROP TABLE "domain_event_journal"`);
    await queryRunner.query(`DROP TABLE "tenancies"`);
    await queryRunner.query(`DROP TABLE "handover_protocols"`);
    await queryRunner.query(`DROP TABLE "tenancy_invitations"`);
    await queryRunner.query(`DROP TABLE "rental_units"`);
    await queryRunner.query(`DROP EXTENSION IF EXISTS btree_gist CASCADE`);
  }
}
