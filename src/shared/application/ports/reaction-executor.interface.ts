import { DomainEvent } from '../../domain/domain-event.interface';

export interface ReactionExecutor {
  readonly reactionId: string;
  readonly version: number;
  execute(event: DomainEvent, transactionalEntityManager?: unknown): Promise<void>;
}
export const REACTION_EXECUTOR_TOKEN = 'ReactionExecutor';
