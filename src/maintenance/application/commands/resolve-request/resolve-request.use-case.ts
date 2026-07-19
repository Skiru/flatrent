import { MaintenanceRequestRepository } from '../../ports/maintenance-request.repository';
import { ResolveRequestCommand, ResolveRequestResult } from './resolve-request.command';
import { MaintenanceRequestNotFoundError } from '../open-request/open-request.use-case';

export class ResolveRequestUseCase {
  constructor(private readonly requestRepository: MaintenanceRequestRepository) {}

  public async execute(command: ResolveRequestCommand): Promise<ResolveRequestResult> {
    const request = await this.requestRepository.findById(command.requestId);
    if (!request) {
      throw new MaintenanceRequestNotFoundError();
    }

    request.resolve(command.resolutionDescription);

    await this.requestRepository.save(request);

    return {
      id: request.id,
      status: request.getStatus(),
      isClosed: request.getIsClosed(),
    };
  }
}
