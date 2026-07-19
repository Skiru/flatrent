export class AcceptInvitationCommand {
  constructor(
    public readonly invitationId: string,
    public readonly tenantId: string,
    public readonly tenancyId: string,
    public readonly startDate: Date,
    public readonly endDate: Date,
  ) {}
}

export interface AcceptInvitationResult {
  readonly tenancyId: string;
  readonly rentalUnitId: string;
  readonly status: string;
}
export class TenancyInvitationExpiredError extends Error {
  constructor() {
    super('The invitation has expired.');
  }
}
export class TenancyInvitationInvalidStateError extends Error {
  constructor() {
    super('The invitation is no longer pending.');
  }
}
