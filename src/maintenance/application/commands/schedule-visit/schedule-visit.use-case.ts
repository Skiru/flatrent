import { MaintenanceRequestRepository } from '../../ports/maintenance-request.repository';
import { ScheduleVisitCommand, ScheduleVisitResult } from './schedule-visit.command';
import { MaintenanceRequestNotFoundError } from '../open-request/open-request.use-case';

export class ScheduleVisitUseCase {
  constructor(private readonly requestRepository: MaintenanceRequestRepository) {}

  public async execute(command: ScheduleVisitCommand): Promise<ScheduleVisitResult> {
    const request = await this.requestRepository.findById(command.requestId);
    if (!request) {
      throw new MaintenanceRequestNotFoundError();
    }

    request.scheduleVisit(command.visitDate, command.handymanId);

    await this.requestRepository.save(request);

    return {
      id: request.id,
      status: request.getStatus(),
      visitDate: request.getVisitDate()!.toISOString(),
    };
  }
}
