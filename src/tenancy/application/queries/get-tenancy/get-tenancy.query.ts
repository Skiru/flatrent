export class GetTenancyQuery {
  constructor(public readonly tenancyId: string) {}
}

export interface TenancyReadModel {
  readonly id: string;
  readonly rentalUnitId: string;
  readonly tenantId: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly status: string;
  readonly noticeDate: string | null;
}
