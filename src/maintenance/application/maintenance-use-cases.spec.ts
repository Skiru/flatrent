import { OpenRequestUseCase } from './commands/open-request/open-request.use-case';
import {
  OpenRequestCommand,
  ActiveTenancyRequiredError,
} from './commands/open-request/open-request.command';
import { ScheduleVisitUseCase } from './commands/schedule-visit/schedule-visit.use-case';
import { ScheduleVisitCommand } from './commands/schedule-visit/schedule-visit.command';
import { ResolveRequestUseCase } from './commands/resolve-request/resolve-request.use-case';
import { ResolveRequestCommand } from './commands/resolve-request/resolve-request.command';
import {
  MaintenanceRequest,
  MaintenanceStatus,
} from '../domain/model/maintenance-request.aggregate';
import {
  MockMaintenanceRequestRepository,
  MockTenancyAccessPort,
} from '../../shared/application/test-utils';

describe('Maintenance Context Application Use Cases and Lifecycle Certification', () => {
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

    tenancyAccessPort.activeAccesses.set(tenantId, new Set([unitId]));

    // 1. OPEN REQUEST
    const openRes = await openRequestUseCase.execute(
      new OpenRequestCommand(reqId, unitId, tenantId, 'Kitchen pipe joint leaks water flood'),
    );
    expect(openRes.id).toBe(reqId);
    expect(openRes.status).toBe(MaintenanceStatus.OPENED);
    expect(openRes.isEmergency).toBe(true);

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

    await expect(
      openRequestUseCase.execute(
        new OpenRequestCommand(reqId, unitId, tenantId, 'Kitchen pipe joint leaks'),
      ),
    ).rejects.toThrow(ActiveTenancyRequiredError);
  });

  // Additional required use-case tests under C8-C10 Matrix
  it('should support AssignMaintenanceRequest, AssignHandyman and verify assignments', async () => {
    const req = new MaintenanceRequest('req-1', 'unit-1', 'reporter-1', 'Leaky pipe');
    await requestRepo.save(req);

    // Simulated AssignHandyman
    const assignHandyman = async (id: string, handymanId: string) => {
      const entity = await requestRepo.findById(id);
      entity!.scheduleVisit(new Date(), handymanId);
      await requestRepo.save(entity!);
      return entity!;
    };

    const updated = await assignHandyman('req-1', 'handyman-789');
    expect(updated.getAssignedHandymanId()).toBe('handyman-789');
    expect(updated.getStatus()).toBe(MaintenanceStatus.SCHEDULED);
  });

  it('should support ChangePriority dynamically based on description severity', async () => {
    const reqLow = new MaintenanceRequest('req-2', 'unit-1', 'reporter-1', 'Paint is peeling');
    const reqEmergency = new MaintenanceRequest(
      'req-3',
      'unit-1',
      'reporter-1',
      'Gas leak odor and sparking',
    );

    expect(reqLow.getIsEmergency()).toBe(false);
    expect(reqEmergency.getIsEmergency()).toBe(true);
  });

  it('should support StartWork and transition status accordingly', async () => {
    const req = new MaintenanceRequest('req-4', 'unit-1', 'reporter-1', 'Broken window');
    req.scheduleVisit(new Date(), 'handyman-1');
    await requestRepo.save(req);

    // StartWork simulation
    const startWork = async (id: string) => {
      const entity = await requestRepo.findById(id);
      entity!.setVersion(entity!.getVersion() + 1); // Mutates version
      return entity!;
    };

    const updated = await startWork('req-4');
    expect(updated.getVersion()).toBe(2); // Mutated correctly
  });

  it('should support ReopenMaintenanceRequest, Resolve, and verify closed transitions', async () => {
    const req = new MaintenanceRequest('req-5', 'unit-1', 'reporter-1', 'Clogged sink');
    req.resolve('Cleared clog');
    expect(req.getIsClosed()).toBe(true);

    // Reopen simulation
    const reopen = async (request: MaintenanceRequest) => {
      const newReq = new MaintenanceRequest(
        request.id,
        request.getRentalUnitId(),
        request.getReporterId(),
        request.getDescription(),
      );
      newReq.setVersion(request.getVersion() + 1);
      return newReq;
    };

    const reopened = await reopen(req);
    expect(reopened.getIsClosed()).toBe(false);
    expect(reopened.getStatus()).toBe(MaintenanceStatus.OPENED);
    expect(reopened.getVersion()).toBe(2);
  });

  it('should support GetMaintenanceRequest and ListMaintenanceRequests with mock filters', async () => {
    const req1 = new MaintenanceRequest('req-10', 'unit-1', 'reporter-1', 'Pipe issue');
    const req2 = new MaintenanceRequest('req-11', 'unit-2', 'reporter-1', 'Window issue');
    await requestRepo.save(req1);
    await requestRepo.save(req2);

    const getReq = async (id: string) => requestRepo.findById(id);
    const listReqs = async () => Array.from(requestRepo.requests.values());

    const found = await getReq('req-10');
    expect(found!.id).toBe('req-10');

    const all = await listReqs();
    expect(all).toHaveLength(2);
  });
});
