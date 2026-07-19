import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  InviteTenantCommand,
  InviteTenantResult,
} from '../../../application/commands/invite-tenant/invite-tenant.command';
import { InviteTenantUseCase } from '../../../application/commands/invite-tenant/invite-tenant.use-case';

@CommandHandler(InviteTenantCommand)
export class InviteTenantNestHandler
  implements ICommandHandler<InviteTenantCommand, InviteTenantResult>
{
  constructor(private readonly useCase: InviteTenantUseCase) {}

  public async execute(command: InviteTenantCommand): Promise<InviteTenantResult> {
    return this.useCase.execute(command);
  }
}
