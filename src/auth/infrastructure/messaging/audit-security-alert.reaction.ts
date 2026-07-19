import { ReactionExecutor } from '../../../shared/application/ports/reaction-executor.interface';
import { DomainEvent } from '../../../shared/domain/domain-event.interface';

export class AuditSecurityAlertReaction implements ReactionExecutor {
  public readonly reactionId = 'auth.audit-security-alert';
  public readonly version = 1;

  public async execute(event: DomainEvent, _transactionalEntityManager?: unknown): Promise<void> {
    const payload = event.payload as Record<string, unknown>;
    console.warn(
      `[SECURITY ALERT] [RELIABLE REACTION] Token reuse detected for session: ${payload?.sessionId || 'unknown'}. Revoking session family!`,
    );
    // Here we can write to dedicated security DB audit tables or external PagerDuty/CloudWatch logs.
  }
}
