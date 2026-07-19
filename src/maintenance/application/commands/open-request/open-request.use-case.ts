import { MaintenanceRequest } from '../../../domain/model/maintenance-request.aggregate';
import { MaintenanceRequestRepository } from '../../ports/maintenance-request.repository';
import { TenancyAccessPort } from '../../ports/tenancy-access.port';
import {
  OpenRequestCommand,
  OpenRequestResult,
  ActiveTenancyRequiredError,
} from './open-request.command';

export class OpenRequestUseCase {
  constructor(
    private readonly requestRepository: MaintenanceRequestRepository,
    private readonly tenancyAccessPort: TenancyAccessPort,
  ) {}

  public async execute(command: OpenRequestCommand): Promise<OpenRequestResult> {
    // 1. Pre-check access before transaction (Anti-Corruption Layer outbound call)
    const hasAccess = await this.tenancyAccessPort.verifyActiveAccess(
      command.reporterId,
      command.rentalUnitId,
    );
    if (!hasAccess) {
      throw new ActiveTenancyRequiredError();
    }

    const existing = await this.requestRepository.findById(command.id);
    if (existing) {
      throw new Error('Maintenance request already registered with this ID.');
    }

    const request = new MaintenanceRequest(
      command.id,
      command.rentalUnitId,
      command.reporterId,
      command.description,
    );

    await this.requestRepository.save(request);

    return {
      id: request.id,
      rentalUnitId: request.getRentalUnitId(),
      status: request.getStatus(),
      isEmergency: request.getIsEmergency(),
    };
  }
}
export class MaintenanceRequestNotFoundError extends Error {
  constructor() {
    super('The requested maintenance request was not found.');
  }
}
