import { MaintenanceRequest } from '../../domain/model/maintenance-request.aggregate';

export interface MaintenanceRequestRepository {
  findById(id: string, transactionalEntityManager?: unknown): Promise<MaintenanceRequest | null>;
  save(request: MaintenanceRequest, transactionalEntityManager?: unknown): Promise<void>;
}
/** @public */
export const MAINTENANCE_REQUEST_REPOSITORY_TOKEN = 'MaintenanceRequestRepository';
