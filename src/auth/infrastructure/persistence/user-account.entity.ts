import { Entity, Column, PrimaryColumn, VersionColumn } from 'typeorm';

@Entity('user_accounts')
export class UserAccountEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ unique: true, length: 255 })
  email!: string;

  @Column({ name: 'password_hash', length: 255 })
  passwordHash!: string;

  @Column({ length: 50 })
  role!: string;

  @Column({ length: 50 })
  status!: string;

  @VersionColumn({ name: 'version', default: 0 })
  version!: number;
}
