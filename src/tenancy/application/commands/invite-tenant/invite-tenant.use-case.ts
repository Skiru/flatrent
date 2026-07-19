import { TenancyInvitation } from '../../../domain/model/tenancy-invitation.aggregate';
import { TenancyInvitationRepository } from '../../ports/tenancy-invitation.repository';
import { RentalUnitRepository } from '../../ports/rental-unit.repository';
import { InviteTenantCommand, InviteTenantResult } from './invite-tenant.command';
import { RentalUnitNotFoundError } from '../register-rental-unit/register-rental-unit.use-case';

export class InviteTenantUseCase {
  constructor(
    private readonly invitationRepository: TenancyInvitationRepository,
    private readonly rentalUnitRepository: RentalUnitRepository,
  ) {}

  public async execute(command: InviteTenantCommand): Promise<InviteTenantResult> {
    const unit = await this.rentalUnitRepository.findById(command.rentalUnitId);
    if (!unit) {
      throw new RentalUnitNotFoundError();
    }

    const invite = new TenancyInvitation(
      command.id,
      command.rentalUnitId,
      command.tenantEmail,
      command.expiresAt,
    );
    await this.invitationRepository.save(invite);

    return {
      id: invite.id,
      rentalUnitId: invite.getRentalUnitId(),
      tenantEmail: invite.getTenantEmail(),
    };
  }
}
export class TenancyInvitationNotFoundError extends Error {
  constructor() {
    super('The requested tenancy invitation was not found.');
  }
}
