import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  ActivateTenancyCommand,
  ActivateTenancyResult,
} from '../../../application/commands/activate-tenancy/activate-tenancy.command';
import { ActivateTenancyUseCase } from '../../../application/commands/activate-tenancy/activate-tenancy.use-case';

@CommandHandler(ActivateTenancyCommand)
export class ActivateTenancyNestHandler
  implements ICommandHandler<ActivateTenancyCommand, ActivateTenancyResult>
{
  constructor(private readonly useCase: ActivateTenancyUseCase) {}

  public async execute(command: ActivateTenancyCommand): Promise<ActivateTenancyResult> {
    return this.useCase.execute(command);
  }
}
