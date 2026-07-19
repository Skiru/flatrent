import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { LogoutCommand } from '../../../application/commands/logout/logout.command';
import { LogoutUseCase } from '../../../application/commands/logout/logout.use-case';

@CommandHandler(LogoutCommand)
export class LogoutNestHandler implements ICommandHandler<LogoutCommand, void> {
  constructor(private readonly useCase: LogoutUseCase) {}

  public async execute(command: LogoutCommand): Promise<void> {
    await this.useCase.execute(command);
  }
}
