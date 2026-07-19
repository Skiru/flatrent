import { RentalUnit } from '../../domain/model/rental-unit.aggregate';

export interface RentalUnitRepository {
  findById(id: string, transactionalEntityManager?: unknown): Promise<RentalUnit | null>;
  save(unit: RentalUnit, transactionalEntityManager?: unknown): Promise<void>;
  findAllByOwnerId(ownerId: string, transactionalEntityManager?: unknown): Promise<RentalUnit[]>;
}
export const RENTAL_UNIT_REPOSITORY_TOKEN = 'RentalUnitRepository';
