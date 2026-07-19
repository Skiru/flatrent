export class OpenRequestCommand {
  constructor(
    public readonly id: string,
    public readonly rentalUnitId: string,
    public readonly reporterId: string,
    public readonly description: string,
  ) {}
}

export interface OpenRequestResult {
  readonly id: string;
  readonly rentalUnitId: string;
  readonly status: string;
  readonly isEmergency: boolean;
}
export class ActiveTenancyRequiredError extends Error {
  constructor() {
    super('The reporter must have an active tenancy for this rental unit.');
  }
}
