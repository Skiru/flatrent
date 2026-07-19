import { Entity, Column, PrimaryColumn, VersionColumn, Index } from 'typeorm';

@Entity('handover_protocols')
export class HandoverProtocolEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Index('idx_handover_tenancy_id')
  @Column('uuid', { name: 'tenancy_id' })
  tenancyId!: string;

  @Column('jsonb', { name: 'meter_readings', default: {} })
  meterReadings!: Record<string, number>;

  @Column('jsonb', { name: 'checklist', default: {} })
  checklist!: Record<string, boolean>;

  @Column({ name: 'is_closed', default: false })
  isClosed!: boolean;

  @VersionColumn({ name: 'version', default: 0 })
  version!: number;
}
