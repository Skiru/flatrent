import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { LoginCommand, LoginResult } from '../../../application/commands/login/login.command';
import { LoginUseCase } from '../../../application/commands/login/login.use-case';

@CommandHandler(LoginCommand)
export class LoginNestHandler implements ICommandHandler<LoginCommand, LoginResult> {
  constructor(private readonly useCase: LoginUseCase) {}

  public async execute(command: LoginCommand): Promise<LoginResult> {
    return this.useCase.execute(command);
  }
}
