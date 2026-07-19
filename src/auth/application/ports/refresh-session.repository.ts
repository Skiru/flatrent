import { RefreshSession } from '../../domain/model/refresh-session.entity';
import { SaveOptions } from '../../../shared/application/ports/save-options.interface';

export interface RefreshSessionRepository {
  findById(id: string, transactionalEntityManager?: unknown): Promise<RefreshSession | null>;
  save(session: RefreshSession, options?: SaveOptions): Promise<void>;
  revokeAllByUserId(userId: string, transactionalEntityManager?: unknown): Promise<void>;
}
export const REFRESH_SESSION_REPOSITORY_TOKEN = 'RefreshSessionRepository';
