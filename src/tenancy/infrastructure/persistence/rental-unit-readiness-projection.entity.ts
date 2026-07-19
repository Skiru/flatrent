import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('rental_unit_readiness_projections')
export class RentalUnitReadinessProjectionEntity {
  @PrimaryColumn('uuid', { name: 'rental_unit_id' })
  rentalUnitId!: string;

  @Column({ name: 'is_ready', default: true })
  isReady!: boolean;

  @Column({ name: 'last_processed_version', type: 'int', default: 0 })
  lastProcessedVersion!: number;

  @Column({ length: 50, default: 'ACTIVE' })
  status!: string; // 'ACTIVE', 'GAP_DETECTED'
}
export const RENTAL_UNIT_READINESS_PROJECTION_ENTITY_TOKEN = 'RentalUnitReadinessProjectionEntity';
