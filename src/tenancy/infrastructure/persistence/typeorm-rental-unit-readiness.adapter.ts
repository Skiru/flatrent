import { EntityManager } from 'typeorm';
import {
  RentalUnitReadinessPort,
  ReadinessProjectionStale,
  RentalUnitNotReadyError,
} from '../../application/ports/rental-unit-readiness.port';
import { RentalUnitReadinessProjectionEntity } from './rental-unit-readiness-projection.entity';

export class TypeOrmRentalUnitReadinessAdapter implements RentalUnitReadinessPort {
  constructor(private readonly defaultEntityManager: EntityManager) {}

  private getRepository(transactionalEntityManager?: unknown) {
    const manager = (transactionalEntityManager as EntityManager) || this.defaultEntityManager;
    return manager.getRepository(RentalUnitReadinessProjectionEntity);
  }

  public async assertReadyToLease(
    rentalUnitId: string,
    transactionalEntityManager?: unknown,
  ): Promise<void> {
    const repo = this.getRepository(transactionalEntityManager);
    const projection = await repo.findOne({ where: { rentalUnitId } });

    if (!projection) {
      return; // No registered issues, default to ready
    }

    if (projection.status === 'GAP_DETECTED') {
      throw new ReadinessProjectionStale();
    }

    if (!projection.isReady) {
      throw new RentalUnitNotReadyError();
    }
  }
}
export const TYPEORM_RENTAL_UNIT_READINESS_ADAPTER_TOKEN = 'TypeOrmRentalUnitReadinessAdapter';
