import { EntityManager } from 'typeorm';
import { DomainEvent } from '../../../shared/domain/domain-event.interface';
import { DomainEventJournalEntity } from './domain-event-journal.entity';
import { LocalEventDispatchEntity } from './local-event-dispatch.entity';
import { IntegrationOutboxEntity } from './integration-outbox.entity';
import { TenancyActivatedPayload } from '../../domain/events/tenancy-activated.event';

interface RichDomainEvent extends DomainEvent {
  readonly actorId?: string;
}

export class EventPersistenceHelper {
  public static async persistEvents(
    events: readonly DomainEvent[],
    manager: EntityManager,
    commandId: string,
    correlationId: string,
    causationId?: string,
  ): Promise<void> {
    if (events.length === 0) {
      return;
    }

    const journalRepo = manager.getRepository(DomainEventJournalEntity);
    const dispatchRepo = manager.getRepository(LocalEventDispatchEntity);
    const outboxRepo = manager.getRepository(IntegrationOutboxEntity);

    for (let index = 0; index < events.length; index++) {
      const event = events[index];
      const occurredDate = new Date(event.occurredAt);

      // 1. Persist Canonical Domain Event Journal
      const journalEntry = new DomainEventJournalEntity();
      journalEntry.eventId = event.eventId;
      journalEntry.eventType = event.eventType;
      journalEntry.eventVersion = event.eventVersion;
      journalEntry.module = 'tenancy';
      journalEntry.aggregateType = event.aggregateType;
      journalEntry.aggregateId = event.aggregateId;
      journalEntry.aggregateVersion = event.aggregateVersion;
      journalEntry.eventIndex = index;
      journalEntry.occurredAt = occurredDate;
      journalEntry.actorId = (event as RichDomainEvent).actorId || null;
      journalEntry.commandId = commandId;
      journalEntry.correlationId = correlationId;
      journalEntry.causationId = causationId || null;
      journalEntry.payloadJson = JSON.stringify(event.payload);

      await journalRepo.save(journalEntry);

      // 2. Persist Local Event Dispatch tracker row
      const dispatchRow = new LocalEventDispatchEntity();
      dispatchRow.eventId = event.eventId;
      dispatchRow.status = 'PENDING';
      dispatchRow.attemptCount = 0;
      dispatchRow.availableAt = occurredDate;
      dispatchRow.dispatchedAt = null;
      dispatchRow.lastError = null;

      await dispatchRepo.save(dispatchRow);

      // 3. Persist Integration Outbox Messages
      // Map TenancyActivatedDomainEvent to TenancyActivated.v1 public integration event
      if (event.eventType === 'TenancyActivatedDomainEvent') {
        const payload = event.payload as TenancyActivatedPayload;
        const outboxRow = new IntegrationOutboxEntity();
        outboxRow.messageId = event.eventId; // Determinisitic mapping
        outboxRow.eventType = 'TenancyActivated.v1';
        outboxRow.eventVersion = 1;
        outboxRow.producer = 'tenancy';
        outboxRow.sourceDomainEventId = event.eventId;
        outboxRow.aggregateType = event.aggregateType;
        outboxRow.aggregateId = event.aggregateId;
        outboxRow.aggregateVersion = event.aggregateVersion;
        outboxRow.occurredAt = occurredDate;
        outboxRow.payloadJson = JSON.stringify({
          tenancyId: event.aggregateId,
          rentalUnitId: payload.rentalUnitId,
          tenantId: payload.tenantId,
          startDate: payload.startDate,
          endDate: payload.endDate,
        });
        outboxRow.status = 'PENDING';
        outboxRow.attemptCount = 0;
        outboxRow.lastError = null;

        await outboxRepo.save(outboxRow);
      }
    }
  }
}
