import { Entity, Column, PrimaryColumn, VersionColumn, Index } from 'typeorm';

@Entity('tenancy_invitations')
export class TenancyInvitationEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Index('idx_invitations_rental_unit_id')
  @Column('uuid', { name: 'rental_unit_id' })
  rentalUnitId!: string;

  @Column({ name: 'tenant_email', length: 255 })
  tenantEmail!: string;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt!: Date;

  @Column({ length: 50 })
  status!: string;

  @VersionColumn({ name: 'version', default: 0 })
  version!: number;
}
