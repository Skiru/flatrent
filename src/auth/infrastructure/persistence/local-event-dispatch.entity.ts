import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('local_event_dispatches')
export class LocalEventDispatchEntity {
  @PrimaryColumn('uuid', { name: 'event_id' })
  eventId!: string;

  @Column({ length: 50, default: 'PENDING' })
  status!: string;

  @Column({ name: 'attempt_count', type: 'int', default: 0 })
  attemptCount!: number;

  @Column({ name: 'available_at', type: 'timestamp' })
  availableAt!: Date;

  @Column({ name: 'dispatched_at', type: 'timestamp', nullable: true })
  dispatchedAt!: Date | null;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError!: string | null;
}
