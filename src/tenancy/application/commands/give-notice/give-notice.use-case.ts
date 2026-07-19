import { TenancyRepository } from '../../ports/tenancy.repository';
import { GiveNoticeCommand, GiveNoticeResult } from './give-notice.command';
import { TenancyNotFoundError } from '../confirm-handover/confirm-handover.command';

export class GiveNoticeUseCase {
  constructor(private readonly tenancyRepository: TenancyRepository) {}

  public async execute(command: GiveNoticeCommand): Promise<GiveNoticeResult> {
    const tenancy = await this.tenancyRepository.findById(command.tenancyId);
    if (!tenancy) {
      throw new TenancyNotFoundError();
    }

    tenancy.giveNotice(command.noticeDate);

    await this.tenancyRepository.save(tenancy);

    return {
      tenancyId: tenancy.id,
      status: tenancy.getStatus(),
    };
  }
}
