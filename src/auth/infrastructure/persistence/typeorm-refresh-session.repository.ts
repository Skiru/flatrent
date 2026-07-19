import { EntityManager } from 'typeorm';
import { RefreshSessionRepository } from '../../application/ports/refresh-session.repository';
import { RefreshSession } from '../../domain/model/refresh-session.entity';
import { RefreshSessionEntity } from './refresh-session.entity';
import { RefreshSessionMapper } from './refresh-session.mapper';
import { SaveOptions } from '../../../shared/application/ports/save-options.interface';
import { EventPersistenceHelper } from './event-persistence.helper';

export class TypeOrmRefreshSessionRepository implements RefreshSessionRepository {
  constructor(private readonly defaultEntityManager: EntityManager) {}

  private getRepository(transactionalEntityManager?: unknown) {
    const manager = (transactionalEntityManager as EntityManager) || this.defaultEntityManager;
    return manager.getRepository(RefreshSessionEntity);
  }

  private getManager(transactionalEntityManager?: unknown): EntityManager {
    return (transactionalEntityManager as EntityManager) || this.defaultEntityManager;
  }

  public async findById(
    id: string,
    transactionalEntityManager?: unknown,
  ): Promise<RefreshSession | null> {
    const repo = this.getRepository(transactionalEntityManager);
    const entity = await repo.findOne({ where: { id } });
    return entity ? RefreshSessionMapper.toDomain(entity) : null;
  }

  public async save(session: RefreshSession, options?: SaveOptions): Promise<void> {
    const txManager = this.getManager(options?.transactionalEntityManager);
    const repo = txManager.getRepository(RefreshSessionEntity);
    const entity = RefreshSessionMapper.toEntity(session);

    const currentVersion = session.getVersion();
    const existing = await repo.findOne({ where: { id: session.id } });
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
    const pendingEvents = session.peekPendingDomainEvents();
    if (pendingEvents.length > 0) {
      await EventPersistenceHelper.persistEvents(
        pendingEvents,
        txManager,
        options?.commandId || '00000000-0000-0000-0000-000000000000',
        options?.correlationId || '00000000-0000-0000-0000-000000000000',
        options?.causationId,
      );
      session.acknowledgeCommittedDomainEvents(pendingEvents.map((e) => e.eventId));
    }

    session.incrementVersion();
  }

  public async revokeAllByUserId(
    userId: string,
    transactionalEntityManager?: unknown,
  ): Promise<void> {
    const repo = this.getRepository(transactionalEntityManager);
    await repo.update({ userId }, { isRevoked: true });
  }
}
export const TYPEORM_REFRESH_SESSION_REPOSITORY_TOKEN = 'TypeOrmRefreshSessionRepository';
