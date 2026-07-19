import { TenancyRepository } from '../../ports/tenancy.repository';
import { GetTenancyQuery, TenancyReadModel } from './get-tenancy.query';
import { TenancyNotFoundError } from '../../commands/confirm-handover/confirm-handover.command';

export class GetTenancyUseCase {
  constructor(private readonly tenancyRepository: TenancyRepository) {}

  public async execute(query: GetTenancyQuery): Promise<TenancyReadModel> {
    const tenancy = await this.tenancyRepository.findById(query.tenancyId);
    if (!tenancy) {
      throw new TenancyNotFoundError();
    }

    return {
      id: tenancy.id,
      rentalUnitId: tenancy.getRentalUnitId(),
      tenantId: tenancy.getTenantId(),
      startDate: tenancy.getStartDate().toISOString(),
      endDate: tenancy.getEndDate().toISOString(),
      status: tenancy.getStatus(),
      noticeDate: tenancy.getNoticeDate() ? tenancy.getNoticeDate()!.toISOString() : null,
    };
  }
}
