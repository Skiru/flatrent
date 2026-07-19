import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('inbox')
export class InboxEntity {
  @PrimaryColumn({ name: 'consumer_name', length: 100 })
  consumerName!: string;

  @PrimaryColumn('uuid', { name: 'message_id' })
  messageId!: string;

  @Column({ name: 'event_type', length: 255 })
  eventType!: string;

  @Column({ name: 'event_version', type: 'int' })
  eventVersion!: number;

  @Column({ name: 'payload_hash', length: 255 })
  payloadHash!: string;

  @Column('uuid', { name: 'source_aggregate_id' })
  sourceAggregateId!: string;

  @Column({ name: 'source_aggregate_version', type: 'int' })
  sourceAggregateVersion!: number;

  @Column({ length: 50, default: 'PENDING' })
  status!: string;

  @Column({ name: 'received_at', type: 'timestamp', default: () => 'NOW()' })
  receivedAt!: Date;

  @Column({ name: 'processed_at', type: 'timestamp', nullable: true })
  processedAt!: Date | null;
}
