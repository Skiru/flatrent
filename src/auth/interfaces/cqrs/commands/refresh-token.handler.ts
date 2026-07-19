import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  RefreshTokenCommand,
  RefreshTokenResult,
} from '../../../application/commands/refresh-token/refresh-token.command';
import { RefreshTokenUseCase } from '../../../application/commands/refresh-token/refresh-token.use-case';

@CommandHandler(RefreshTokenCommand)
export class RefreshTokenNestHandler
  implements ICommandHandler<RefreshTokenCommand, RefreshTokenResult>
{
  constructor(private readonly useCase: RefreshTokenUseCase) {}

  public async execute(command: RefreshTokenCommand): Promise<RefreshTokenResult> {
    return this.useCase.execute(command);
  }
}
