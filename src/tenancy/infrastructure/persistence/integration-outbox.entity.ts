import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('integration_outbox')
export class IntegrationOutboxEntity {
  @PrimaryColumn('uuid', { name: 'message_id' })
  messageId!: string;

  @Column({ name: 'event_type', length: 255 })
  eventType!: string;

  @Column({ name: 'event_version', type: 'int' })
  eventVersion!: number;

  @Column({ length: 50 })
  producer!: string;

  @Column('uuid', { name: 'source_domain_event_id' })
  sourceDomainEventId!: string;

  @Column({ name: 'aggregate_type', length: 100 })
  aggregateType!: string;

  @Column('uuid', { name: 'aggregate_id' })
  aggregateId!: string;

  @Column({ name: 'aggregate_version', type: 'int' })
  aggregateVersion!: number;

  @Column({ name: 'occurred_at', type: 'timestamp' })
  occurredAt!: Date;

  @Column({ name: 'payload_json', type: 'text' })
  payloadJson!: string;

  @Column({ length: 50, default: 'PENDING' })
  status!: string;

  @Column({ name: 'attempt_count', type: 'int', default: 0 })
  attemptCount!: number;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError!: string | null;
}
