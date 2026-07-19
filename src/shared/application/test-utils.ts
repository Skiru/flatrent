import { UserAccount } from '../../auth/domain/model/user-account.aggregate';
import { Email } from '../../auth/domain/model/email.value-object';
import { UserAccountRepository } from '../../auth/application/ports/user-account.repository';
import { RefreshSession } from '../../auth/domain/model/refresh-session.entity';
import { RefreshSessionRepository } from '../../auth/application/ports/refresh-session.repository';
import { RentalUnit } from '../../tenancy/domain/model/rental-unit.aggregate';
import { RentalUnitRepository } from '../../tenancy/application/ports/rental-unit.repository';
import { TenancyInvitation } from '../../tenancy/domain/model/tenancy-invitation.aggregate';
import { TenancyInvitationRepository } from '../../tenancy/application/ports/tenancy-invitation.repository';
import { Tenancy } from '../../tenancy/domain/model/tenancy.aggregate';
import { TenancyRepository } from '../../tenancy/application/ports/tenancy.repository';
import { HandoverProtocol } from '../../tenancy/domain/model/handover-protocol.aggregate';
import { HandoverProtocolRepository } from '../../tenancy/application/ports/handover-protocol.repository';
import { MaintenanceRequest } from '../../maintenance/domain/model/maintenance-request.aggregate';
import { MaintenanceRequestRepository } from '../../maintenance/application/ports/maintenance-request.repository';
import { TenancyAccessPort } from '../../maintenance/application/ports/tenancy-access.port';
import { PasswordHasher } from '../../auth/application/ports/password-hasher.interface';
import { IdGenerator } from './ports/id-generator.interface';
import { Clock } from '../domain/clock.interface';

export class MockClock implements Clock {
  private currentTime: Date = new Date('2026-07-19T00:00:00.000Z');

  public now(): Date {
    return this.currentTime;
  }
  public nowIso(): string {
    return this.currentTime.toISOString();
  }
  public setTime(date: Date): void {
    this.currentTime = date;
  }
}

export class MockIdGenerator implements IdGenerator {
  private nextIdNum = 1;
  public generate(): string {
    return `id-${this.nextIdNum++}`;
  }
}

export class MockPasswordHasher implements PasswordHasher {
  public async hash(password: string): Promise<string> {
    return `hash-${password}`;
  }
  public async compare(password: string, hash: string): Promise<boolean> {
    return `hash-${password}` === hash;
  }
}

export class MockUserAccountRepository implements UserAccountRepository {
  public users = new Map<string, UserAccount>();

  public async findById(id: string): Promise<UserAccount | null> {
    return this.users.get(id) || null;
  }
  public async findByEmail(email: Email): Promise<UserAccount | null> {
    for (const user of this.users.values()) {
      if (user.getEmail().equals(email)) {
        return user;
      }
    }
    return null;
  }
  public async save(user: UserAccount): Promise<void> {
    this.users.set(user.id, user);
  }
}

export class MockRefreshSessionRepository implements RefreshSessionRepository {
  public sessions = new Map<string, RefreshSession>();

  public async findById(id: string): Promise<RefreshSession | null> {
    return this.sessions.get(id) || null;
  }
  public async save(session: RefreshSession): Promise<void> {
    this.sessions.set(session.id, session);
  }
}

export class MockRentalUnitRepository implements RentalUnitRepository {
  public units = new Map<string, RentalUnit>();

  public async findById(id: string): Promise<RentalUnit | null> {
    return this.units.get(id) || null;
  }
  public async save(unit: RentalUnit): Promise<void> {
    this.units.set(unit.id, unit);
  }
  public async findAllByOwnerId(ownerId: string): Promise<RentalUnit[]> {
    return Array.from(this.units.values()).filter((unit) => unit.getOwnerId() === ownerId);
  }
}

export class MockTenancyInvitationRepository implements TenancyInvitationRepository {
  public invitations = new Map<string, TenancyInvitation>();

  public async findById(id: string): Promise<TenancyInvitation | null> {
    return this.invitations.get(id) || null;
  }
  public async save(invitation: TenancyInvitation): Promise<void> {
    this.invitations.set(invitation.id, invitation);
  }
}

export class MockTenancyRepository implements TenancyRepository {
  public tenancies = new Map<string, Tenancy>();

  public async findById(id: string): Promise<Tenancy | null> {
    return this.tenancies.get(id) || null;
  }
  public async save(tenancy: Tenancy): Promise<void> {
    this.tenancies.set(tenancy.id, tenancy);
  }
  public async hasOverlappingTenancy(
    rentalUnitId: string,
    startDate: Date,
    endDate: Date,
    excludeTenancyId?: string,
  ): Promise<boolean> {
    for (const tenancy of this.tenancies.values()) {
      if (excludeTenancyId && tenancy.id === excludeTenancyId) {
        continue;
      }
      if (tenancy.getRentalUnitId() === rentalUnitId) {
        // Date overlap check: (start1 <= end2) && (end1 >= start2)
        const overlap =
          tenancy.getStartDate().getTime() <= endDate.getTime() &&
          tenancy.getEndDate().getTime() >= startDate.getTime();
        if (overlap) {
          return true;
        }
      }
    }
    return false;
  }
}

export class MockHandoverProtocolRepository implements HandoverProtocolRepository {
  public protocols = new Map<string, HandoverProtocol>();

  public async findById(id: string): Promise<HandoverProtocol | null> {
    return this.protocols.get(id) || null;
  }
  public async save(handover: HandoverProtocol): Promise<void> {
    this.protocols.set(handover.id, handover);
  }
}

export class MockMaintenanceRequestRepository implements MaintenanceRequestRepository {
  public requests = new Map<string, MaintenanceRequest>();

  public async findById(id: string): Promise<MaintenanceRequest | null> {
    return this.requests.get(id) || null;
  }
  public async save(request: MaintenanceRequest): Promise<void> {
    this.requests.set(request.id, request);
  }
}

export class MockTenancyAccessPort implements TenancyAccessPort {
  public activeAccesses = new Map<string, Set<string>>(); // userId -> Set<rentalUnitId>

  public async verifyActiveAccess(userId: string, rentalUnitId: string): Promise<boolean> {
    const units = this.activeAccesses.get(userId);
    return units ? units.has(rentalUnitId) : false;
  }
}
