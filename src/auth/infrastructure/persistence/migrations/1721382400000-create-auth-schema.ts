import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuthSchema1721382400000 implements MigrationInterface {
  public name = 'CreateAuthSchema1721382400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. User Accounts Table
    await queryRunner.query(`
      CREATE TABLE "user_accounts" (
        "id" UUID PRIMARY KEY,
        "email" VARCHAR(255) NOT NULL UNIQUE,
        "password_hash" VARCHAR(255) NOT NULL,
        "role" VARCHAR(50) NOT NULL,
        "status" VARCHAR(50) NOT NULL,
        "version" INT NOT NULL DEFAULT 0
      )
    `);

    // 2. Refresh Sessions Table
    await queryRunner.query(`
      CREATE TABLE "refresh_sessions" (
        "id" UUID PRIMARY KEY,
        "user_id" UUID NOT NULL,
        "token_hash" VARCHAR(255) NOT NULL UNIQUE,
        "expires_at" TIMESTAMP NOT NULL,
        "is_revoked" BOOLEAN NOT NULL DEFAULT false,
        "version" INT NOT NULL DEFAULT 0
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_refresh_sessions_user_id" ON "refresh_sessions" ("user_id")
    `);

    // 3. Domain Event Journal Table
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
        CONSTRAINT "uq_journal_event_ordering" UNIQUE ("module", "aggregate_type", "aggregate_id", "aggregate_version", "event_index")
      )
    `);

    // 4. Local Event Dispatches Tracker
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

    // 5. Domain Reaction Deliveries Tracker
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

    // 6. Integration Outbox Table
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "integration_outbox"`);
    await queryRunner.query(`DROP TABLE "domain_reaction_deliveries"`);
    await queryRunner.query(`DROP TABLE "local_event_dispatches"`);
    await queryRunner.query(`DROP TABLE "domain_event_journal"`);
    await queryRunner.query(`DROP TABLE "refresh_sessions"`);
    await queryRunner.query(`DROP TABLE "user_accounts"`);
  }
}
