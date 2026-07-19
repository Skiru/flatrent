import { MaintenanceEmergencyPolicy } from './policies/emergency.policy';
import { MaintenanceRequest, MaintenanceStatus } from './model/maintenance-request.aggregate';

describe('MaintenanceRequest Context Domain Logic', () => {
  it('should automatically flag emergencies based on description keywords using policy', () => {
    expect(MaintenanceEmergencyPolicy.isEmergency('Slight squeak in doors')).toBe(false);
    expect(
      MaintenanceEmergencyPolicy.isEmergency('Water leak in the kitchen flooding the floor!'),
    ).toBe(true);
    expect(MaintenanceEmergencyPolicy.isEmergency('Smell of gas in the hallway')).toBe(true);
    expect(MaintenanceEmergencyPolicy.isEmergency('Blackout - no power in the whole unit')).toBe(
      true,
    );
  });

  it('should manage schedule and resolution flows cleanly', () => {
    const request = new MaintenanceRequest(
      'req-1',
      'unit-123',
      'tenant-456',
      'Water leak in kitchen',
    );

    // Initial state check
    expect(request.getStatus()).toBe(MaintenanceStatus.OPENED);
    expect(request.getIsEmergency()).toBe(true); // flagged by policy

    // Schedule visit
    const visitDate = new Date();
    request.scheduleVisit(visitDate, 'handyman-789');
    expect(request.getStatus()).toBe(MaintenanceStatus.SCHEDULED);
    expect(request.getVisitDate()).toBe(visitDate);
    expect(request.getAssignedHandymanId()).toBe('handyman-789');

    // Resolve
    request.resolve('Fixed the pipe joint');
    expect(request.getStatus()).toBe(MaintenanceStatus.RESOLVED);
    expect(request.getResolutionDescription()).toBe('Fixed the pipe joint');
    expect(request.getIsClosed()).toBe(true);

    // closed request cannot be rescheduled or resolved again
    expect(() => request.scheduleVisit(new Date(), 'handyman-000')).toThrow(
      'Maintenance request is closed',
    );
  });

  it('should support rejection transitions', () => {
    const request = new MaintenanceRequest(
      'req-1',
      'unit-123',
      'tenant-456',
      'Minor wall paint chip',
    );
    request.reject();
    expect(request.getStatus()).toBe(MaintenanceStatus.REJECTED);
    expect(request.getIsClosed()).toBe(true);
  });
});
