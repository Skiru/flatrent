import { EntityManager } from 'typeorm';
import { UnitOfWork } from '../../../shared/application/ports/unit-of-work.interface';

export class TypeOrmUnitOfWork implements UnitOfWork {
  constructor(private readonly entityManager: EntityManager) {}

  public async runInTransaction<T>(
    work: (transactionalEntityManager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.entityManager.transaction(async (transactionalEntityManager) => {
      return work(transactionalEntityManager);
    });
  }
}
export const TYPEORM_UNIT_OF_WORK_TOKEN = 'TypeOrmUnitOfWork';
