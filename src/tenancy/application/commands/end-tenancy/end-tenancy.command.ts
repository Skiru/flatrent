export class EndTenancyCommand {
  constructor(public readonly tenancyId: string) {}
}

export interface EndTenancyResult {
  readonly tenancyId: string;
  readonly status: string;
}
