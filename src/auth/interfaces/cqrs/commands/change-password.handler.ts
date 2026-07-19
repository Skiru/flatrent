import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ChangePasswordCommand } from '../../../application/commands/change-password/change-password.command';
import { ChangePasswordUseCase } from '../../../application/commands/change-password/change-password.use-case';

@CommandHandler(ChangePasswordCommand)
export class ChangePasswordNestHandler implements ICommandHandler<ChangePasswordCommand, void> {
  constructor(private readonly useCase: ChangePasswordUseCase) {}

  public async execute(command: ChangePasswordCommand): Promise<void> {
    await this.useCase.execute(command);
  }
}
