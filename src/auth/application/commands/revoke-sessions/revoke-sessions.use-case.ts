import { RefreshSessionRepository } from '../../ports/refresh-session.repository';
import { RevokeSessionsCommand } from './revoke-sessions.command';

export class RevokeSessionsUseCase {
  constructor(private readonly sessionRepository: RefreshSessionRepository) {}

  public async execute(command: RevokeSessionsCommand): Promise<void> {
    await this.sessionRepository.revokeAllByUserId(command.userId);
  }
}
