import { RentalUnit } from './model/rental-unit.aggregate';
import { TenancyInvitation, InvitationStatus } from './model/tenancy-invitation.aggregate';
import { HandoverProtocol } from './model/handover-protocol.aggregate';
import { Tenancy, TenancyStatus } from './model/tenancy.aggregate';

describe('Tenancy Context Domain Logic', () => {
  const rentalUnitId = 'unit-123';
  const tenantId = 'tenant-456';

  it('should manage rental unit creation and basic property assertions', () => {
    const unit = new RentalUnit(rentalUnitId, 'landlord-789', '123 Monolith St');
    expect(unit.getOwnerId()).toBe('landlord-789');
    expect(unit.getAddress()).toBe('123 Monolith St');
  });

  it('should evaluate invitation lifecycle status transitions', () => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10000);
    const invite = new TenancyInvitation('invite-1', rentalUnitId, 'tenant@test.com', expiresAt);

    expect(invite.getStatus()).toBe(InvitationStatus.PENDING);

    invite.accept(now);
    expect(invite.getStatus()).toBe(InvitationStatus.ACCEPTED);

    const expiredInvite = new TenancyInvitation(
      'invite-2',
      rentalUnitId,
      'tenant@test.com',
      new Date(now.getTime() - 10000),
    );
    expect(() => expiredInvite.accept(now)).toThrow('Invitation has expired');
    expect(expiredInvite.getStatus()).toBe(InvitationStatus.EXPIRED);
  });

  it('should validate handover protocols and reject negative meter readings', () => {
    const handover = new HandoverProtocol('handover-1', 'tenancy-1');

    handover.recordMeterReading('electricity', 123.45);
    expect(handover.getMeterReadings().electricity).toBe(123.45);

    expect(() => handover.recordMeterReading('electricity', -5)).toThrow(
      'Meter reading cannot be negative',
    );

    handover.recordChecklistItem('keysDelivered', true);
    expect(handover.getChecklist().keysDelivered).toBe(true);

    handover.close();
    expect(handover.getIsClosed()).toBe(true);

    expect(() => handover.recordChecklistItem('keysDelivered', false)).toThrow(
      'Handover protocol is closed',
    );
  });

  it('should transition tenancy status and raise TenancyActivatedDomainEvent upon correct validation', () => {
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + 86400000 * 30); // 30 days
    const tenancy = new Tenancy('tenancy-1', rentalUnitId, tenantId, startDate, endDate);

    expect(tenancy.getStatus()).toBe(TenancyStatus.RESERVED);

    const handover = new HandoverProtocol('handover-1', 'tenancy-1');

    // Handover protocol must be closed before activation
    expect(() => tenancy.activate(handover, '2026-07-19T00:00:00Z', 'event-999')).toThrow(
      'Handover protocol must be closed',
    );

    handover.close();
    tenancy.activate(handover, '2026-07-19T00:00:00Z', 'event-999');

    expect(tenancy.getStatus()).toBe(TenancyStatus.ACTIVE);
    expect(tenancy.getVersion()).toBe(0); // Version managed by persistence layer

    const events = tenancy.peekPendingDomainEvents();
    expect(events.length).toBe(1);
    expect(events[0].eventType).toBe('TenancyActivatedDomainEvent');
  });

  it('should block activation if the handover protocol belongs to a different tenancy', () => {
    const tenancy = new Tenancy('tenancy-1', rentalUnitId, tenantId, new Date(), new Date());
    const foreignHandover = new HandoverProtocol('handover-2', 'different-tenancy');
    foreignHandover.close();

    expect(() => tenancy.activate(foreignHandover, '2026-07-19T00:00:00Z', 'event-999')).toThrow(
      'Handover protocol does not match this tenancy',
    );
  });

  it('should support notice and irreversible end state', () => {
    const tenancy = new Tenancy(
      'tenancy-1',
      rentalUnitId,
      tenantId,
      new Date(),
      new Date(),
      TenancyStatus.ACTIVE,
    );

    tenancy.giveNotice(new Date());
    expect(tenancy.getStatus()).toBe(TenancyStatus.TERMINATED);

    tenancy.end();
    expect(tenancy.getStatus()).toBe(TenancyStatus.ENDED);

    // End is terminal and irreversible
    expect(() => tenancy.end()).toThrow('Tenancy can only be ended from ACTIVE or TERMINATED');
  });
});
