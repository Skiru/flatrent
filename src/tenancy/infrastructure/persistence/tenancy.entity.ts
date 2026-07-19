import { Entity, Column, PrimaryColumn, VersionColumn, Index } from 'typeorm';

@Entity('tenancies')
export class TenancyEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Index('idx_tenancies_rental_unit_id')
  @Column('uuid', { name: 'rental_unit_id' })
  rentalUnitId!: string;

  @Index('idx_tenancies_tenant_id')
  @Column('uuid', { name: 'tenant_id' })
  tenantId!: string;

  @Column({ name: 'start_date', type: 'timestamp' })
  startDate!: Date;

  @Column({ name: 'end_date', type: 'timestamp' })
  endDate!: Date;

  @Column({ length: 50 })
  status!: string;

  @Column({ name: 'notice_date', type: 'timestamp', nullable: true })
  noticeDate!: Date | null;

  @VersionColumn({ name: 'version', default: 0 })
  version!: number;
}
