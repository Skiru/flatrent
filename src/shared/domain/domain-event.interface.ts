export interface DomainEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly eventVersion: number;
  readonly occurredAt: string;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly aggregateVersion: number;
  readonly payload: unknown;
}
