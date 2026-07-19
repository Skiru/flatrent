import { HandoverProtocol } from '../../../domain/model/handover-protocol.aggregate';
import { HandoverProtocolRepository } from '../../ports/handover-protocol.repository';
import { TenancyRepository } from '../../ports/tenancy.repository';
import {
  ConfirmHandoverCommand,
  ConfirmHandoverResult,
  TenancyNotFoundError,
} from './confirm-handover.command';

export class ConfirmHandoverUseCase {
  constructor(
    private readonly handoverRepository: HandoverProtocolRepository,
    private readonly tenancyRepository: TenancyRepository,
  ) {}

  public async execute(command: ConfirmHandoverCommand): Promise<ConfirmHandoverResult> {
    const tenancy = await this.tenancyRepository.findById(command.tenancyId);
    if (!tenancy) {
      throw new TenancyNotFoundError();
    }

    const handover = new HandoverProtocol(command.id, command.tenancyId);

    // Record meter readings and check items
    for (const [key, val] of Object.entries(command.meterReadings)) {
      handover.recordMeterReading(key, val);
    }
    for (const [key, val] of Object.entries(command.checklist)) {
      handover.recordChecklistItem(key, val);
    }

    // Close to seal the protocol
    handover.close();

    await this.handoverRepository.save(handover);

    return {
      id: handover.id,
      tenancyId: handover.getTenancyId(),
      isClosed: handover.getIsClosed(),
    };
  }
}
export class HandoverProtocolNotFoundError extends Error {
  constructor() {
    super('The requested handover protocol was not found.');
  }
}
