import { DataSource, DataSourceOptions } from 'typeorm';
import { UserAccountEntity } from './user-account.entity';
import { RefreshSessionEntity } from './refresh-session.entity';
import { DomainEventJournalEntity } from './domain-event-journal.entity';
import { LocalEventDispatchEntity } from './local-event-dispatch.entity';
import { DomainReactionDeliveryEntity } from './domain-reaction-delivery.entity';
import { IntegrationOutboxEntity } from './integration-outbox.entity';
import { CreateAuthSchema1721382400000 } from './migrations/1721382400000-create-auth-schema';

export const authDataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url:
    process.env.AUTH_DATABASE_URL ||
    'postgresql://admin:pw123456@localhost:15432/flatren_auth?schema=public',
  entities: [
    UserAccountEntity,
    RefreshSessionEntity,
    DomainEventJournalEntity,
    LocalEventDispatchEntity,
    DomainReactionDeliveryEntity,
    IntegrationOutboxEntity,
  ],
  migrations: [CreateAuthSchema1721382400000],
  synchronize: false,
  logging: false,
};

export const authDataSource = new DataSource(authDataSourceOptions);
