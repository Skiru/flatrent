import { Entity, Column, PrimaryColumn, VersionColumn, Index } from 'typeorm';

@Entity('rental_units')
export class RentalUnitEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Index('idx_rental_units_owner_id')
  @Column('uuid', { name: 'owner_id' })
  ownerId!: string;

  @Column({ length: 255 })
  address!: string;

  @VersionColumn({ name: 'version', default: 0 })
  version!: number;
}
