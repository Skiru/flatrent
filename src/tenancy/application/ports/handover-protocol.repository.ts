import { HandoverProtocol } from '../../domain/model/handover-protocol.aggregate';

export interface HandoverProtocolRepository {
  findById(id: string, transactionalEntityManager?: unknown): Promise<HandoverProtocol | null>;
  save(handover: HandoverProtocol, transactionalEntityManager?: unknown): Promise<void>;
}
export const HANDOVER_PROTOCOL_REPOSITORY_TOKEN = 'HandoverProtocolRepository';
