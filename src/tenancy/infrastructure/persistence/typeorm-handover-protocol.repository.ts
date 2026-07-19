import { EntityManager } from 'typeorm';
import { HandoverProtocolRepository } from '../../application/ports/handover-protocol.repository';
import { HandoverProtocol } from '../../domain/model/handover-protocol.aggregate';
import { HandoverProtocolEntity } from './handover-protocol.entity';
import { HandoverProtocolMapper } from './handover-protocol.mapper';
import { SaveOptions } from '../../../shared/application/ports/save-options.interface';

export class TypeOrmHandoverProtocolRepository implements HandoverProtocolRepository {
  constructor(private readonly defaultEntityManager: EntityManager) {}

  private getRepository(transactionalEntityManager?: unknown) {
    const manager = (transactionalEntityManager as EntityManager) || this.defaultEntityManager;
    return manager.getRepository(HandoverProtocolEntity);
  }

  private getManager(transactionalEntityManager?: unknown): EntityManager {
    return (transactionalEntityManager as EntityManager) || this.defaultEntityManager;
  }

  public async findById(
    id: string,
    transactionalEntityManager?: unknown,
  ): Promise<HandoverProtocol | null> {
    const repo = this.getRepository(transactionalEntityManager);
    const entity = await repo.findOne({ where: { id } });
    return entity ? HandoverProtocolMapper.toDomain(entity) : null;
  }

  public async save(handover: HandoverProtocol, options?: SaveOptions): Promise<void> {
    const txManager = this.getManager(options?.transactionalEntityManager);
    const repo = txManager.getRepository(HandoverProtocolEntity);
    const entity = HandoverProtocolMapper.toEntity(handover);

    const currentVersion = handover.getVersion();
    const existing = await repo.findOne({ where: { id: handover.id } });
    if (existing) {
      if (existing.version !== currentVersion) {
        throw new Error('Optimistic Lock Conflict: version mismatch.');
      }
      entity.version = currentVersion + 1;
      await repo.save(entity);
      handover.incrementVersion(); // increment ONLY on update!
    } else {
      entity.version = 0;
      await repo.save(entity);
    }
  }
}
