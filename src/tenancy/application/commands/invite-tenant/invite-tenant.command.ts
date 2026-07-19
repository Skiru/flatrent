export class InviteTenantCommand {
  constructor(
    public readonly id: string,
    public readonly rentalUnitId: string,
    public readonly tenantEmail: string,
    public readonly expiresAt: Date,
  ) {}
}

export interface InviteTenantResult {
  readonly id: string;
  readonly rentalUnitId: string;
  readonly tenantEmail: string;
}
