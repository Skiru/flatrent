import { RegisterRentalUnitUseCase } from './commands/register-rental-unit/register-rental-unit.use-case';
import { RegisterRentalUnitCommand } from './commands/register-rental-unit/register-rental-unit.command';
import { InviteTenantUseCase } from './commands/invite-tenant/invite-tenant.use-case';
import { InviteTenantCommand } from './commands/invite-tenant/invite-tenant.command';
import { AcceptInvitationUseCase } from './commands/accept-invitation/accept-invitation.use-case';
import { AcceptInvitationCommand } from './commands/accept-invitation/accept-invitation.command';
import { ConfirmHandoverUseCase } from './commands/confirm-handover/confirm-handover.use-case';
import { ConfirmHandoverCommand } from './commands/confirm-handover/confirm-handover.command';
import { ActivateTenancyUseCase } from './commands/activate-tenancy/activate-tenancy.use-case';
import { ActivateTenancyCommand } from './commands/activate-tenancy/activate-tenancy.command';
import { GiveNoticeUseCase } from './commands/give-notice/give-notice.use-case';
import { GiveNoticeCommand } from './commands/give-notice/give-notice.command';
import { EndTenancyUseCase } from './commands/end-tenancy/end-tenancy.use-case';
import { EndTenancyCommand } from './commands/end-tenancy/end-tenancy.command';
import { GetTenancyUseCase } from './queries/get-tenancy/get-tenancy.use-case';
import { GetTenancyQuery } from './queries/get-tenancy/get-tenancy.query';
import { ListLandlordRentalUnitsUseCase } from './queries/list-units/list-units.use-case';
import { ListLandlordRentalUnitsQuery } from './queries/list-units/list-units.query';
import { TenancyStatus, TenancyDatesOverlapError } from '../domain/model/tenancy.aggregate';
import {
  MockRentalUnitRepository,
  MockTenancyInvitationRepository,
  MockTenancyRepository,
  MockHandoverProtocolRepository,
  MockClock,
  MockIdGenerator,
} from '../../shared/application/test-utils';

describe('Tenancy Context Application Use Cases', () => {
  let unitRepo: MockRentalUnitRepository;
  let inviteRepo: MockTenancyInvitationRepository;
  let tenancyRepo: MockTenancyRepository;
  let handoverRepo: MockHandoverProtocolRepository;
  let clock: MockClock;
  let idGen: MockIdGenerator;

  let registerUnitUseCase: RegisterRentalUnitUseCase;
  let inviteTenantUseCase: InviteTenantUseCase;
  let acceptInviteUseCase: AcceptInvitationUseCase;
  let confirmHandoverUseCase: ConfirmHandoverUseCase;
  let activateTenancyUseCase: ActivateTenancyUseCase;
  let giveNoticeUseCase: GiveNoticeUseCase;
  let endTenancyUseCase: EndTenancyUseCase;
  let getTenancyUseCase: GetTenancyUseCase;
  let listUnitsUseCase: ListLandlordRentalUnitsUseCase;

  beforeEach(() => {
    unitRepo = new MockRentalUnitRepository();
    inviteRepo = new MockTenancyInvitationRepository();
    tenancyRepo = new MockTenancyRepository();
    handoverRepo = new MockHandoverProtocolRepository();
    clock = new MockClock();
    idGen = new MockIdGenerator();

    registerUnitUseCase = new RegisterRentalUnitUseCase(unitRepo);
    inviteTenantUseCase = new InviteTenantUseCase(inviteRepo, unitRepo);
    acceptInviteUseCase = new AcceptInvitationUseCase(inviteRepo, tenancyRepo, clock);
    confirmHandoverUseCase = new ConfirmHandoverUseCase(handoverRepo, tenancyRepo);
    activateTenancyUseCase = new ActivateTenancyUseCase(tenancyRepo, handoverRepo, idGen, clock);
    giveNoticeUseCase = new GiveNoticeUseCase(tenancyRepo);
    endTenancyUseCase = new EndTenancyUseCase(tenancyRepo);
    getTenancyUseCase = new GetTenancyUseCase(tenancyRepo);
    listUnitsUseCase = new ListLandlordRentalUnitsUseCase(unitRepo);
  });

  it('should execute full tenancy lease lifecycle successfully', async () => {
    const ownerId = 'landlord-1';
    const tenantId = 'tenant-2';
    const unitId = 'unit-3';
    const inviteId = 'invite-4';
    const tenancyId = 'tenancy-5';
    const handoverId = 'handover-6';

    // 1. REGISTER RENTAL UNIT
    await registerUnitUseCase.execute(
      new RegisterRentalUnitCommand(unitId, ownerId, '123 Monolith Ave'),
    );
    const landlordUnits = await listUnitsUseCase.execute(new ListLandlordRentalUnitsQuery(ownerId));
    expect(landlordUnits.length).toBe(1);
    expect(landlordUnits[0].address).toBe('123 Monolith Ave');

    // 2. INVITE TENANT
    const expiresAt = new Date(clock.now().getTime() + 86400000);
    await inviteTenantUseCase.execute(
      new InviteTenantCommand(inviteId, unitId, 'tenant@test.com', expiresAt),
    );

    // 3. ACCEPT INVITATION (creates Tenancy RESERVED)
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + 86400000 * 30);
    const acceptRes = await acceptInviteUseCase.execute(
      new AcceptInvitationCommand(inviteId, tenantId, tenancyId, startDate, endDate),
    );
    expect(acceptRes.tenancyId).toBe(tenancyId);
    expect(acceptRes.status).toBe(TenancyStatus.RESERVED);

    // 4. CONFIRM HANDOVER
    await confirmHandoverUseCase.execute(
      new ConfirmHandoverCommand(handoverId, tenancyId, { water: 1042.5 }, { keysDelivered: true }),
    );
    const handover = await handoverRepo.findById(handoverId);
    expect(handover!.getIsClosed()).toBe(true);

    // 5. ACTIVATE TENANCY
    const activeRes = await activateTenancyUseCase.execute(
      new ActivateTenancyCommand(tenancyId, handoverId),
    );
    expect(activeRes.status).toBe(TenancyStatus.ACTIVE);

    // Query Tenancy details
    const tenancyDetails = await getTenancyUseCase.execute(new GetTenancyQuery(tenancyId));
    expect(tenancyDetails.status).toBe(TenancyStatus.ACTIVE);
    expect(tenancyDetails.tenantId).toBe(tenantId);

    // 6. GIVE NOTICE
    const noticeRes = await giveNoticeUseCase.execute(new GiveNoticeCommand(tenancyId, endDate));
    expect(noticeRes.status).toBe(TenancyStatus.TERMINATED);

    // 7. END TENANCY
    const endRes = await endTenancyUseCase.execute(new EndTenancyCommand(tenancyId));
    expect(endRes.status).toBe(TenancyStatus.ENDED);
  });

  it('should prevent overlapping tenancy bookings for the same rental unit', async () => {
    const ownerId = 'landlord-1';
    const unitId = 'unit-3';
    const inviteId1 = 'invite-4a';
    const inviteId2 = 'invite-4b';
    const tenancyId1 = 'tenancy-5a';
    const tenancyId2 = 'tenancy-5b';

    await registerUnitUseCase.execute(
      new RegisterRentalUnitCommand(unitId, ownerId, '123 Monolith Ave'),
    );

    const expires = new Date(clock.now().getTime() + 86400000);
    await inviteTenantUseCase.execute(
      new InviteTenantCommand(inviteId1, unitId, 'tenantA@test.com', expires),
    );
    await inviteTenantUseCase.execute(
      new InviteTenantCommand(inviteId2, unitId, 'tenantB@test.com', expires),
    );

    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + 86400000 * 30);

    // First booking accepted
    await acceptInviteUseCase.execute(
      new AcceptInvitationCommand(inviteId1, 'tenant-A', tenancyId1, startDate, endDate),
    );

    // Second booking overlapping is rejected immediately
    await expect(
      acceptInviteUseCase.execute(
        new AcceptInvitationCommand(inviteId2, 'tenant-B', tenancyId2, startDate, endDate),
      ),
    ).rejects.toThrow(TenancyDatesOverlapError);
  });
});
