import { DomainEvent } from './domain-event.interface';

export abstract class AggregateRoot<TId> {
  private readonly pendingEvents: DomainEvent[] = [];
  private aggregateVersion: number = 0;

  constructor(public readonly id: TId) {}

  protected recordDomainEvent(event: DomainEvent): void {
    this.pendingEvents.push(event);
  }

  public peekPendingDomainEvents(): readonly DomainEvent[] {
    return [...this.pendingEvents];
  }

  public acknowledgeCommittedDomainEvents(eventIds: readonly string[]): void {
    const idsSet = new Set(eventIds);
    let i = this.pendingEvents.length;
    while (i--) {
      if (idsSet.has(this.pendingEvents[i].eventId)) {
        this.pendingEvents.splice(i, 1);
      }
    }
  }

  public getVersion(): number {
    return this.aggregateVersion;
  }

  public setVersion(version: number): void {
    this.aggregateVersion = version;
  }

  public incrementVersion(): void {
    this.aggregateVersion++;
  }
}
