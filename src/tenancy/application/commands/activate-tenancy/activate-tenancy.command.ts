export class ActivateTenancyCommand {
  constructor(
    public readonly tenancyId: string,
    public readonly handoverProtocolId: string,
  ) {}
}

export interface ActivateTenancyResult {
  readonly tenancyId: string;
  readonly status: string;
}
