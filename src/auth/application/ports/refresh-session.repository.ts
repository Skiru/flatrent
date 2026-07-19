import { RefreshSession } from '../../domain/model/refresh-session.entity';

export interface RefreshSessionRepository {
  findById(id: string, transactionalEntityManager?: unknown): Promise<RefreshSession | null>;
  save(session: RefreshSession, transactionalEntityManager?: unknown): Promise<void>;
}
export const REFRESH_SESSION_REPOSITORY_TOKEN = 'RefreshSessionRepository';
