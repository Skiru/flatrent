import { Entity, Column, PrimaryColumn, VersionColumn, Index } from 'typeorm';

@Entity('refresh_sessions')
export class RefreshSessionEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Index('idx_refresh_sessions_user_id')
  @Column('uuid', { name: 'user_id' })
  userId!: string;

  @Column({ name: 'token_hash', length: 255, unique: true })
  tokenHash!: string;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt!: Date;

  @Column({ name: 'is_revoked', default: false })
  isRevoked!: boolean;

  @VersionColumn({ name: 'version', default: 0 })
  version!: number;
}
