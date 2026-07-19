import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  ConfirmHandoverCommand,
  ConfirmHandoverResult,
} from '../../../application/commands/confirm-handover/confirm-handover.command';
import { ConfirmHandoverUseCase } from '../../../application/commands/confirm-handover/confirm-handover.use-case';

@CommandHandler(ConfirmHandoverCommand)
export class ConfirmHandoverNestHandler
  implements ICommandHandler<ConfirmHandoverCommand, ConfirmHandoverResult>
{
  constructor(private readonly useCase: ConfirmHandoverUseCase) {}

  public async execute(command: ConfirmHandoverCommand): Promise<ConfirmHandoverResult> {
    return this.useCase.execute(command);
  }
}
