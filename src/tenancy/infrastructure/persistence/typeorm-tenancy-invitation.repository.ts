import { EntityManager } from 'typeorm';
import { TenancyInvitationRepository } from '../../application/ports/tenancy-invitation.repository';
import { TenancyInvitation } from '../../domain/model/tenancy-invitation.aggregate';
import { TenancyInvitationEntity } from './tenancy-invitation.entity';
import { TenancyInvitationMapper } from './tenancy-invitation.mapper';
import { SaveOptions } from '../../../shared/application/ports/save-options.interface';

export class TypeOrmTenancyInvitationRepository implements TenancyInvitationRepository {
  constructor(private readonly defaultEntityManager: EntityManager) {}

  private getRepository(transactionalEntityManager?: unknown) {
    const manager = (transactionalEntityManager as EntityManager) || this.defaultEntityManager;
    return manager.getRepository(TenancyInvitationEntity);
  }

  private getManager(transactionalEntityManager?: unknown): EntityManager {
    return (transactionalEntityManager as EntityManager) || this.defaultEntityManager;
  }

  public async findById(
    id: string,
    transactionalEntityManager?: unknown,
  ): Promise<TenancyInvitation | null> {
    const repo = this.getRepository(transactionalEntityManager);
    const entity = await repo.findOne({ where: { id } });
    return entity ? TenancyInvitationMapper.toDomain(entity) : null;
  }

  public async save(invitation: TenancyInvitation, options?: SaveOptions): Promise<void> {
    const txManager = this.getManager(options?.transactionalEntityManager);
    const repo = txManager.getRepository(TenancyInvitationEntity);
    const entity = TenancyInvitationMapper.toEntity(invitation);

    const currentVersion = invitation.getVersion();
    const existing = await repo.findOne({ where: { id: invitation.id } });
    if (existing) {
      if (existing.version !== currentVersion) {
        throw new Error('Optimistic Lock Conflict: version mismatch.');
      }
      entity.version = currentVersion + 1;
      await repo.save(entity);
      invitation.incrementVersion(); // increment ONLY on update!
    } else {
      entity.version = 0;
      await repo.save(entity);
    }
  }
}
