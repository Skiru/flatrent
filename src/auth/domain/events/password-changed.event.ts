import { DomainEvent } from '../../../shared/domain/domain-event.interface';

export class PasswordChangedDomainEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly eventType = 'PasswordChangedDomainEvent';
  public readonly eventVersion = 1;
  public readonly occurredAt: string;

  constructor(
    public readonly aggregateId: string,
    public readonly aggregateType: string,
    public readonly payload: { readonly userId: string },
    occurredAt: string,
    eventId: string,
    public readonly aggregateVersion: number,
  ) {
    this.eventId = eventId;
    this.occurredAt = occurredAt;
  }
}
