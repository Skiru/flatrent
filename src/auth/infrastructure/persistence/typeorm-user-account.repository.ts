import { EntityManager } from 'typeorm';
import { UserAccountRepository } from '../../application/ports/user-account.repository';
import { UserAccount } from '../../domain/model/user-account.aggregate';
import { Email } from '../../domain/model/email.value-object';
import { UserAccountEntity } from './user-account.entity';
import { UserAccountMapper } from './user-account.mapper';
import { SaveOptions } from '../../../shared/application/ports/save-options.interface';
import { EventPersistenceHelper } from './event-persistence.helper';

export class TypeOrmUserAccountRepository implements UserAccountRepository {
  constructor(private readonly defaultEntityManager: EntityManager) {}

  private getRepository(transactionalEntityManager?: unknown) {
    const manager = (transactionalEntityManager as EntityManager) || this.defaultEntityManager;
    return manager.getRepository(UserAccountEntity);
  }

  private getManager(transactionalEntityManager?: unknown): EntityManager {
    return (transactionalEntityManager as EntityManager) || this.defaultEntityManager;
  }

  public async findById(
    id: string,
    transactionalEntityManager?: unknown,
  ): Promise<UserAccount | null> {
    const repo = this.getRepository(transactionalEntityManager);
    const entity = await repo.findOne({ where: { id } });
    return entity ? UserAccountMapper.toDomain(entity) : null;
  }

  public async findByEmail(
    email: Email,
    transactionalEntityManager?: unknown,
  ): Promise<UserAccount | null> {
    const repo = this.getRepository(transactionalEntityManager);
    const entity = await repo.findOne({ where: { email: email.value } });
    return entity ? UserAccountMapper.toDomain(entity) : null;
  }

  public async save(user: UserAccount, options?: SaveOptions): Promise<void> {
    const txManager = this.getManager(options?.transactionalEntityManager);
    const repo = txManager.getRepository(UserAccountEntity);
    const entity = UserAccountMapper.toEntity(user);

    const currentVersion = user.getVersion();
    const existing = await repo.findOne({ where: { id: user.id } });
    if (existing) {
      if (existing.version !== currentVersion) {
        throw new Error('Optimistic Lock Conflict: version mismatch.');
      }
      entity.version = currentVersion + 1;
      await repo.save(entity);
    } else {
      entity.version = 0;
      await repo.save(entity);
    }

    // Save pending domain events, reaction deliveries, and outbox atomically
    const pendingEvents = user.peekPendingDomainEvents();
    if (pendingEvents.length > 0) {
      await EventPersistenceHelper.persistEvents(
        pendingEvents,
        txManager,
        options?.commandId || '00000000-0000-0000-0000-000000000000',
        options?.correlationId || '00000000-0000-0000-0000-000000000000',
        options?.causationId,
      );
      // We keep events in memory until post-commit dispatch succeeds,
      // but we must not allow duplicate saves on subsequent calls.
      // So after a successful SQL write, we acknowledge them.
      user.acknowledgeCommittedDomainEvents(pendingEvents.map((e) => e.eventId));
    }

    user.incrementVersion(); // align version on domain object
  }
}
export const TYPEORM_USER_ACCOUNT_REPOSITORY_TOKEN = 'TypeOrmUserAccountRepository';
