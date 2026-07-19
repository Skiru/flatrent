import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  RegisterUserCommand,
  RegisterUserResult,
} from '../../../application/commands/register-user/register-user.command';
import { RegisterUserUseCase } from '../../../application/commands/register-user/register-user.use-case';

@CommandHandler(RegisterUserCommand)
export class RegisterUserNestHandler
  implements ICommandHandler<RegisterUserCommand, RegisterUserResult>
{
  constructor(private readonly useCase: RegisterUserUseCase) {}

  public async execute(command: RegisterUserCommand): Promise<RegisterUserResult> {
    return this.useCase.execute(command);
  }
}
