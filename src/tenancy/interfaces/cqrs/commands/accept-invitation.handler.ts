import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  AcceptInvitationCommand,
  AcceptInvitationResult,
} from '../../../application/commands/accept-invitation/accept-invitation.command';
import { AcceptInvitationUseCase } from '../../../application/commands/accept-invitation/accept-invitation.use-case';

@CommandHandler(AcceptInvitationCommand)
export class AcceptInvitationNestHandler
  implements ICommandHandler<AcceptInvitationCommand, AcceptInvitationResult>
{
  constructor(private readonly useCase: AcceptInvitationUseCase) {}

  public async execute(command: AcceptInvitationCommand): Promise<AcceptInvitationResult> {
    return this.useCase.execute(command);
  }
}
