import { EntityManager } from 'typeorm';
import { TenancyRepository } from '../../application/ports/tenancy.repository';
import { Tenancy } from '../../domain/model/tenancy.aggregate';
import { TenancyEntity } from './tenancy.entity';
import { TenancyMapper } from './tenancy.mapper';
import { SaveOptions } from '../../../shared/application/ports/save-options.interface';
import { EventPersistenceHelper } from './event-persistence.helper';

export class TypeOrmTenancyRepository implements TenancyRepository {
  constructor(private readonly defaultEntityManager: EntityManager) {}

  private getRepository(transactionalEntityManager?: unknown) {
    const manager = (transactionalEntityManager as EntityManager) || this.defaultEntityManager;
    return manager.getRepository(TenancyEntity);
  }

  private getManager(transactionalEntityManager?: unknown): EntityManager {
    return (transactionalEntityManager as EntityManager) || this.defaultEntityManager;
  }

  public async findById(id: string, transactionalEntityManager?: unknown): Promise<Tenancy | null> {
    const repo = this.getRepository(transactionalEntityManager);
    const entity = await repo.findOne({ where: { id } });
    return entity ? TenancyMapper.toDomain(entity) : null;
  }

  public async hasOverlappingTenancy(
    rentalUnitId: string,
    startDate: Date,
    endDate: Date,
    excludeTenancyId?: string,
    transactionalEntityManager?: unknown,
  ): Promise<boolean> {
    const repo = this.getRepository(transactionalEntityManager);
    const query = repo
      .createQueryBuilder('tenancy')
      .where('tenancy.rental_unit_id = :rentalUnitId', { rentalUnitId })
      .andWhere('tenancy.status IN (:...statuses)', { statuses: ['ACTIVE', 'RESERVED'] })
      // Date overlap check: (startDate <= existingEndDate) && (endDate >= existingStartDate)
      .andWhere('tenancy.start_date <= :endDate', { endDate })
      .andWhere('tenancy.end_date >= :startDate', { startDate });

    if (excludeTenancyId) {
      query.andWhere('tenancy.id != :excludeTenancyId', { excludeTenancyId });
    }

    const overlap = await query.getOne();
    return !!overlap;
  }

  public async save(tenancy: Tenancy, options?: SaveOptions): Promise<void> {
    const txManager = this.getManager(options?.transactionalEntityManager);
    const repo = txManager.getRepository(TenancyEntity);
    const entity = TenancyMapper.toEntity(tenancy);

    const currentVersion = tenancy.getVersion();
    const existing = await repo.findOne({ where: { id: tenancy.id } });
    if (existing) {
      if (existing.version !== currentVersion - 1) {
        throw new Error('Optimistic Lock Conflict: version mismatch.');
      }
      entity.version = currentVersion;
      await repo.save(entity);
    } else {
      entity.version = 0;
      await repo.save(entity);
    }

    // Save pending domain events atomically
    const pendingEvents = tenancy.peekPendingDomainEvents();
    if (pendingEvents.length > 0) {
      await EventPersistenceHelper.persistEvents(
        pendingEvents,
        txManager,
        options?.commandId || '00000000-0000-0000-0000-000000000000',
        options?.correlationId || '00000000-0000-0000-0000-000000000000',
        options?.causationId,
      );
      tenancy.acknowledgeCommittedDomainEvents(pendingEvents.map((e) => e.eventId));
    }
  }
}
export const TYPEORM_TENANCY_REPOSITORY_TOKEN = 'TypeOrmTenancyRepository';
