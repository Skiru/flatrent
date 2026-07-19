import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('domain_reaction_deliveries')
export class DomainReactionDeliveryEntity {
  @PrimaryColumn('uuid', { name: 'event_id' })
  eventId!: string;

  @PrimaryColumn({ name: 'reaction_id', length: 255 })
  reactionId!: string;

  @PrimaryColumn({ name: 'reaction_version', type: 'int' })
  reactionVersion!: number;

  @Column({ length: 50, default: 'PENDING' })
  status!: string;

  @Column({ name: 'attempt_count', type: 'int', default: 0 })
  attemptCount!: number;

  @Column({ name: 'available_at', type: 'timestamp' })
  availableAt!: Date;

  @Column({ name: 'processed_at', type: 'timestamp', nullable: true })
  processedAt!: Date | null;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError!: string | null;
}
