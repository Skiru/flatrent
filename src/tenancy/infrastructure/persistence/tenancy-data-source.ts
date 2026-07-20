import { DataSource, DataSourceOptions } from 'typeorm';
import { RentalUnitEntity } from './rental-unit.entity';
import { TenancyInvitationEntity } from './tenancy-invitation.entity';
import { HandoverProtocolEntity } from './handover-protocol.entity';
import { TenancyEntity } from './tenancy.entity';
import { DomainEventJournalEntity } from './domain-event-journal.entity';
import { LocalEventDispatchEntity } from './local-event-dispatch.entity';
import { DomainReactionDeliveryEntity } from './domain-reaction-delivery.entity';
import { IntegrationOutboxEntity } from './integration-outbox.entity';
import { InboxEntity } from './inbox.entity';
import { RentalUnitReadinessProjectionEntity } from './rental-unit-readiness-projection.entity';
import { CreateTenancySchema1721382500000 } from './migrations/1721382500000-create-tenancy-schema';
import { CreateReadinessProjectionTable1721382600000 } from './migrations/1721382600000-create-readiness-projection-table';

export const tenancyDataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url:
    process.env.TENANCY_DATABASE_URL ||
    'postgresql://admin:pw123456@localhost:15433/flatren_tenancy?schema=public',
  entities: [
    RentalUnitEntity,
    TenancyInvitationEntity,
    HandoverProtocolEntity,
    TenancyEntity,
    DomainEventJournalEntity,
    LocalEventDispatchEntity,
    DomainReactionDeliveryEntity,
    IntegrationOutboxEntity,
    InboxEntity,
    RentalUnitReadinessProjectionEntity,
  ],
  migrations: [CreateTenancySchema1721382500000, CreateReadinessProjectionTable1721382600000],
  synchronize: false,
  logging: false,
};

export const tenancyDataSource = new DataSource(tenancyDataSourceOptions);
