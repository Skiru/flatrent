import { RefreshSessionRepository } from '../../ports/refresh-session.repository';
import { LogoutCommand } from './logout.command';
import { SessionNotFoundError } from '../refresh-token/refresh-token.command';

export class LogoutUseCase {
  constructor(private readonly sessionRepository: RefreshSessionRepository) {}

  public async execute(command: LogoutCommand): Promise<void> {
    const session = await this.sessionRepository.findById(command.sessionId);
    if (!session) {
      throw new SessionNotFoundError();
    }

    session.revoke();
    await this.sessionRepository.save(session);
  }
}
//
