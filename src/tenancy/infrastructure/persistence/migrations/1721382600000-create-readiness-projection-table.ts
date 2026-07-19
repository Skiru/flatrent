import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateReadinessProjectionTable1721382600000 implements MigrationInterface {
  public name = 'CreateReadinessProjectionTable1721382600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "rental_unit_readiness_projections" (
        "rental_unit_id" UUID PRIMARY KEY,
        "is_ready" BOOLEAN NOT NULL DEFAULT true,
        "last_processed_version" INT NOT NULL DEFAULT 0,
        "status" VARCHAR(50) NOT NULL DEFAULT 'ACTIVE'
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "rental_unit_readiness_projections"`);
  }
}
