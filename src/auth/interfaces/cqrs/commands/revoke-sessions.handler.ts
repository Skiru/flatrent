import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RevokeSessionsCommand } from '../../../application/commands/revoke-sessions/revoke-sessions.command';
import { RevokeSessionsUseCase } from '../../../application/commands/revoke-sessions/revoke-sessions.use-case';

@CommandHandler(RevokeSessionsCommand)
export class RevokeSessionsNestHandler implements ICommandHandler<RevokeSessionsCommand, void> {
  constructor(private readonly useCase: RevokeSessionsUseCase) {}

  public async execute(command: RevokeSessionsCommand): Promise<void> {
    await this.useCase.execute(command);
  }
}
