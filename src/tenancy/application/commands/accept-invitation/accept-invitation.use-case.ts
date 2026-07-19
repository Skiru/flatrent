import { TenancyInvitationRepository } from '../../ports/tenancy-invitation.repository';
import { TenancyRepository } from '../../ports/tenancy.repository';
import {
  AcceptInvitationCommand,
  AcceptInvitationResult,
  TenancyInvitationExpiredError,
  TenancyInvitationInvalidStateError,
} from './accept-invitation.command';
import { Tenancy, TenancyDatesOverlapError } from '../../../domain/model/tenancy.aggregate';
import { Clock } from '../../../../shared/domain/clock.interface';
import { TenancyInvitationNotFoundError } from '../invite-tenant/invite-tenant.use-case';

export class AcceptInvitationUseCase {
  constructor(
    private readonly invitationRepository: TenancyInvitationRepository,
    private readonly tenancyRepository: TenancyRepository,
    private readonly clock: Clock,
  ) {}

  public async execute(command: AcceptInvitationCommand): Promise<AcceptInvitationResult> {
    const invite = await this.invitationRepository.findById(command.invitationId);
    if (!invite) {
      throw new TenancyInvitationNotFoundError();
    }

    const now = this.clock.now();
    if (invite.isExpired(now)) {
      throw new TenancyInvitationExpiredError();
    }

    // Pre-check for overlapping active/reserved tenancies for this rental unit
    const overlapExists = await this.tenancyRepository.hasOverlappingTenancy(
      invite.getRentalUnitId(),
      command.startDate,
      command.endDate,
    );
    if (overlapExists) {
      throw new TenancyDatesOverlapError();
    }

    try {
      invite.accept(now);
    } catch (e: unknown) {
      if (e instanceof Error && e.message?.includes('expired')) {
        await this.invitationRepository.save(invite);
        throw new TenancyInvitationExpiredError();
      }
      throw new TenancyInvitationInvalidStateError();
    }

    const tenancy = new Tenancy(
      command.tenancyId,
      invite.getRentalUnitId(),
      command.tenantId,
      command.startDate,
      command.endDate,
    );

    // Save both within transactional context
    await this.invitationRepository.save(invite);
    await this.tenancyRepository.save(tenancy);

    return {
      tenancyId: tenancy.id,
      rentalUnitId: tenancy.getRentalUnitId(),
      status: tenancy.getStatus(),
    };
  }
}
