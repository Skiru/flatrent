import { OpenRequestUseCase } from './commands/open-request/open-request.use-case';
import {
  OpenRequestCommand,
  ActiveTenancyRequiredError,
} from './commands/open-request/open-request.command';
import { ScheduleVisitUseCase } from './commands/schedule-visit/schedule-visit.use-case';
import { ScheduleVisitCommand } from './commands/schedule-visit/schedule-visit.command';
import { ResolveRequestUseCase } from './commands/resolve-request/resolve-request.use-case';
import { ResolveRequestCommand } from './commands/resolve-request/resolve-request.command';
import { MaintenanceStatus } from '../domain/model/maintenance-request.aggregate';
import {
  MockMaintenanceRequestRepository,
  MockTenancyAccessPort,
} from '../../shared/application/test-utils';

describe('Maintenance Context Application Use Cases', () => {
  let requestRepo: MockMaintenanceRequestRepository;
  let tenancyAccessPort: MockTenancyAccessPort;

  let openRequestUseCase: OpenRequestUseCase;
  let scheduleVisitUseCase: ScheduleVisitUseCase;
  let resolveRequestUseCase: ResolveRequestUseCase;

  beforeEach(() => {
    requestRepo = new MockMaintenanceRequestRepository();
    tenancyAccessPort = new MockTenancyAccessPort();

    openRequestUseCase = new OpenRequestUseCase(requestRepo, tenancyAccessPort);
    scheduleVisitUseCase = new ScheduleVisitUseCase(requestRepo);
    resolveRequestUseCase = new ResolveRequestUseCase(requestRepo);
  });

  it('should successfully open, schedule, and resolve maintenance requests if the reporter has active access', async () => {
    const tenantId = 'tenant-1';
    const unitId = 'unit-123';
    const reqId = 'request-999';

    // Grant active access to the tenant in our Anti-Corruption Layer mock
    tenancyAccessPort.activeAccesses.set(tenantId, new Set([unitId]));

    // 1. OPEN REQUEST
    const openRes = await openRequestUseCase.execute(
      new OpenRequestCommand(reqId, unitId, tenantId, 'Kitchen pipe joint leaks water flood'),
    );
    expect(openRes.id).toBe(reqId);
    expect(openRes.status).toBe(MaintenanceStatus.OPENED);
    expect(openRes.isEmergency).toBe(true); // Flagged by policy from description keyword "leak/flood"!

    // 2. SCHEDULE VISIT
    const visitDate = new Date();
    const scheduleRes = await scheduleVisitUseCase.execute(
      new ScheduleVisitCommand(reqId, visitDate, 'handyman-456'),
    );
    expect(scheduleRes.status).toBe(MaintenanceStatus.SCHEDULED);

    // 3. RESOLVE REQUEST
    const resolveRes = await resolveRequestUseCase.execute(
      new ResolveRequestCommand(reqId, 'Replaced pipe joint'),
    );
    expect(resolveRes.status).toBe(MaintenanceStatus.RESOLVED);
    expect(resolveRes.isClosed).toBe(true);
  });

  it('should deny opening a request if the reporter does not have an active tenancy', async () => {
    const tenantId = 'tenant-1';
    const unitId = 'unit-123';
    const reqId = 'request-999';

    // Do NOT grant access in our mock

    await expect(
      openRequestUseCase.execute(
        new OpenRequestCommand(reqId, unitId, tenantId, 'Kitchen pipe joint leaks'),
      ),
    ).rejects.toThrow(ActiveTenancyRequiredError);
  });
});
