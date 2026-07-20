import { DomainEvent } from '../../../shared/domain/domain-event.interface';

export interface TenancyActivatedPayload {
  readonly rentalUnitId: string;
  readonly tenantId: string;
  readonly startDate: string;
  readonly endDate: string;
}

export class TenancyActivatedDomainEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly eventType = 'TenancyActivatedDomainEvent';
  public readonly eventVersion = 1;
  public readonly occurredAt: string;

  constructor(
    public readonly aggregateId: string,
    public readonly aggregateType: string,
    public readonly payload: TenancyActivatedPayload,
    occurredAt: string,
    eventId: string,
    public readonly aggregateVersion: number,
  ) {
    this.eventId = eventId;
    this.occurredAt = occurredAt;
  }
}
