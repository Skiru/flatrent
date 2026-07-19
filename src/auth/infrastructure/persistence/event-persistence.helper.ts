import { EntityManager } from 'typeorm';
import { DomainEvent } from '../../../shared/domain/domain-event.interface';
import { DomainEventJournalEntity } from './domain-event-journal.entity';
import { LocalEventDispatchEntity } from './local-event-dispatch.entity';
import { DomainReactionDeliveryEntity } from './domain-reaction-delivery.entity';
import { IntegrationOutboxEntity } from './integration-outbox.entity';
import { AUTH_RELIABLE_REACTIONS_CATALOG } from './reliable-reactions-catalog';
import { UserRegisteredPayload } from '../../domain/model/user-account.aggregate';

interface RichDomainEvent extends DomainEvent {
  readonly aggregateVersion?: number;
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
    const deliveryRepo = manager.getRepository(DomainReactionDeliveryEntity);
    const outboxRepo = manager.getRepository(IntegrationOutboxEntity);

    for (let index = 0; index < events.length; index++) {
      const event = events[index];
      const occurredDate = new Date(event.occurredAt);

      // 1. Persist Canonical Domain Event Journal
      const journalEntry = new DomainEventJournalEntity();
      journalEntry.eventId = event.eventId;
      journalEntry.eventType = event.eventType;
      journalEntry.eventVersion = event.eventVersion;
      journalEntry.module = 'auth';
      journalEntry.aggregateType = event.aggregateType;
      journalEntry.aggregateId = event.aggregateId;
      // We number aggregate_version and event_index sequence to satisfy UNIQUE constraint!
      journalEntry.aggregateVersion = (event as RichDomainEvent).aggregateVersion || 1;
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

      // 3. Persist Targeted Reliable Reaction Deliveries
      const eventKey = `${event.eventType}.v${event.eventVersion}`;
      const reactions = AUTH_RELIABLE_REACTIONS_CATALOG[eventKey] || [];
      for (const rx of reactions) {
        const deliveryRow = new DomainReactionDeliveryEntity();
        deliveryRow.eventId = event.eventId;
        deliveryRow.reactionId = rx.reactionId;
        deliveryRow.reactionVersion = rx.version;
        deliveryRow.status = 'PENDING';
        deliveryRow.attemptCount = 0;
        deliveryRow.availableAt = occurredDate;
        deliveryRow.processedAt = null;
        deliveryRow.lastError = null;

        await deliveryRepo.save(deliveryRow);
      }

      // 4. Persist Integration Outbox Messages
      // Map UserRegisteredDomainEvent to UserRegistered.v1 public integration event
      if (event.eventType === 'UserRegisteredDomainEvent') {
        const outboxRow = new IntegrationOutboxEntity();
        outboxRow.messageId = event.eventId; // Determinisitic mapping
        outboxRow.eventType = 'UserRegistered.v1';
        outboxRow.eventVersion = 1;
        outboxRow.producer = 'auth';
        outboxRow.sourceDomainEventId = event.eventId;
        outboxRow.aggregateType = event.aggregateType;
        outboxRow.aggregateId = event.aggregateId;
        outboxRow.aggregateVersion = (event as RichDomainEvent).aggregateVersion || 1;
        outboxRow.occurredAt = occurredDate;
        outboxRow.payloadJson = JSON.stringify({
          userId: event.aggregateId,
          email: (event.payload as UserRegisteredPayload).email,
          role: (event.payload as UserRegisteredPayload).role,
        });
        outboxRow.status = 'PENDING';
        outboxRow.attemptCount = 0;
        outboxRow.lastError = null;

        await outboxRepo.save(outboxRow);
      }
    }
  }
}
