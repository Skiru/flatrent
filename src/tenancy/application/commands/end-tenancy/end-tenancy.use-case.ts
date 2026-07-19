import { TenancyRepository } from '../../ports/tenancy.repository';
import { EndTenancyCommand, EndTenancyResult } from './end-tenancy.command';
import { TenancyNotFoundError } from '../confirm-handover/confirm-handover.command';

export class EndTenancyUseCase {
  constructor(private readonly tenancyRepository: TenancyRepository) {}

  public async execute(command: EndTenancyCommand): Promise<EndTenancyResult> {
    const tenancy = await this.tenancyRepository.findById(command.tenancyId);
    if (!tenancy) {
      throw new TenancyNotFoundError();
    }

    tenancy.end();

    await this.tenancyRepository.save(tenancy);

    return {
      tenancyId: tenancy.id,
      status: tenancy.getStatus(),
    };
  }
}
