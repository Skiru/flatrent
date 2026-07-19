import { RefreshSession } from '../../domain/model/refresh-session.entity';
import { RefreshSessionEntity } from './refresh-session.entity';

export class RefreshSessionMapper {
  public static toEntity(domain: RefreshSession): RefreshSessionEntity {
    const entity = new RefreshSessionEntity();
    entity.id = domain.id;
    entity.userId = domain.getUserId();
    entity.tokenHash = domain.getTokenHash();
    entity.expiresAt = domain.getExpiresAt();
    entity.isRevoked = domain.getIsRevoked();
    entity.version = domain.getVersion();
    return entity;
  }

  public static toDomain(entity: RefreshSessionEntity): RefreshSession {
    const domain = new RefreshSession(
      entity.id,
      entity.userId,
      entity.tokenHash,
      entity.expiresAt,
      entity.isRevoked,
    );
    domain.setVersion(entity.version);
    return domain;
  }
}
export const REFRESH_SESSION_MAPPER_TOKEN = 'RefreshSessionMapper';
