import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  EndTenancyCommand,
  EndTenancyResult,
} from '../../../application/commands/end-tenancy/end-tenancy.command';
import { EndTenancyUseCase } from '../../../application/commands/end-tenancy/end-tenancy.use-case';

@CommandHandler(EndTenancyCommand)
export class EndTenancyNestHandler implements ICommandHandler<EndTenancyCommand, EndTenancyResult> {
  constructor(private readonly useCase: EndTenancyUseCase) {}

  public async execute(command: EndTenancyCommand): Promise<EndTenancyResult> {
    return this.useCase.execute(command);
  }
}
