import { Tenancy } from '../../domain/model/tenancy.aggregate';

export interface TenancyRepository {
  findById(id: string, transactionalEntityManager?: unknown): Promise<Tenancy | null>;
  save(tenancy: Tenancy, transactionalEntityManager?: unknown): Promise<void>;
  hasOverlappingTenancy(
    rentalUnitId: string,
    startDate: Date,
    endDate: Date,
    excludeTenancyId?: string,
    transactionalEntityManager?: unknown,
  ): Promise<boolean>;
}
export const TENANCY_REPOSITORY_TOKEN = 'TenancyRepository';
