export class RegisterRentalUnitCommand {
  constructor(
    public readonly id: string,
    public readonly ownerId: string,
    public readonly address: string,
  ) {}
}

export interface RegisterRentalUnitResult {
  readonly id: string;
  readonly ownerId: string;
  readonly address: string;
}
