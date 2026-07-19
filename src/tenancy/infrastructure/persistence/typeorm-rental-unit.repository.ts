import { EntityManager } from 'typeorm';
import { RentalUnitRepository } from '../../application/ports/rental-unit.repository';
import { RentalUnit } from '../../domain/model/rental-unit.aggregate';
import { RentalUnitEntity } from './rental-unit.entity';
import { RentalUnitMapper } from './rental-unit.mapper';
import { SaveOptions } from '../../../shared/application/ports/save-options.interface';

export class TypeOrmRentalUnitRepository implements RentalUnitRepository {
  constructor(private readonly defaultEntityManager: EntityManager) {}

  private getRepository(transactionalEntityManager?: unknown) {
    const manager = (transactionalEntityManager as EntityManager) || this.defaultEntityManager;
    return manager.getRepository(RentalUnitEntity);
  }

  private getManager(transactionalEntityManager?: unknown): EntityManager {
    return (transactionalEntityManager as EntityManager) || this.defaultEntityManager;
  }

  public async findById(
    id: string,
    transactionalEntityManager?: unknown,
  ): Promise<RentalUnit | null> {
    const repo = this.getRepository(transactionalEntityManager);
    const entity = await repo.findOne({ where: { id } });
    return entity ? RentalUnitMapper.toDomain(entity) : null;
  }

  public async findAllByOwnerId(
    ownerId: string,
    transactionalEntityManager?: unknown,
  ): Promise<RentalUnit[]> {
    const repo = this.getRepository(transactionalEntityManager);
    const entities = await repo.find({ where: { ownerId } });
    return entities.map((entity) => RentalUnitMapper.toDomain(entity));
  }

  public async save(unit: RentalUnit, options?: SaveOptions): Promise<void> {
    const txManager = this.getManager(options?.transactionalEntityManager);
    const repo = txManager.getRepository(RentalUnitEntity);
    const entity = RentalUnitMapper.toEntity(unit);

    const currentVersion = unit.getVersion();
    const existing = await repo.findOne({ where: { id: unit.id } });
    if (existing) {
      if (existing.version !== currentVersion) {
        throw new Error('Optimistic Lock Conflict: version mismatch.');
      }
      entity.version = currentVersion + 1;
      await repo.save(entity);
      unit.incrementVersion(); // increment ONLY on update!
    } else {
      entity.version = 0;
      await repo.save(entity);
    }
  }
}
