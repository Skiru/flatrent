import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import { Email } from './email.value-object';
import { DomainEvent } from '../../../shared/domain/domain-event.interface';
import { PasswordChangedDomainEvent } from '../events/password-changed.event';

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  BLOCKED = 'BLOCKED',
}

export enum UserRole {
  LANDLORD = 'LANDLORD',
  TENANT = 'TENANT',
}

export interface UserRegisteredPayload {
  readonly email: string;
  readonly role: UserRole;
}

export class UserRegisteredDomainEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly eventType = 'UserRegisteredDomainEvent';
  public readonly eventVersion = 1;
  public readonly occurredAt: string;

  constructor(
    public readonly aggregateId: string,
    public readonly aggregateType: string,
    public readonly payload: UserRegisteredPayload,
    occurredAt: string,
    eventId: string,
  ) {
    this.eventId = eventId;
    this.occurredAt = occurredAt;
  }
}

export class UserAccount extends AggregateRoot<string> {
  private email: Email;
  private passwordHash: string;
  private role: UserRole;
  private status: UserStatus;

  constructor(
    id: string,
    email: Email,
    passwordHash: string,
    role: UserRole,
    status: UserStatus = UserStatus.ACTIVE,
  ) {
    super(id);
    this.email = email;
    this.passwordHash = passwordHash;
    this.role = role;
    this.status = status;
  }

  public static register(
    id: string,
    email: Email,
    passwordHash: string,
    role: UserRole,
    eventId: string,
    occurredAt: string,
  ): UserAccount {
    const user = new UserAccount(id, email, passwordHash, role, UserStatus.ACTIVE);
    user.recordDomainEvent(
      new UserRegisteredDomainEvent(
        id,
        'UserAccount',
        { email: email.value, role },
        occurredAt,
        eventId,
      ),
    );
    return user;
  }

  public getEmail(): Email {
    return this.email;
  }

  public getPasswordHash(): string {
    return this.passwordHash;
  }

  public getRole(): UserRole {
    return this.role;
  }

  public getStatus(): UserStatus {
    return this.status;
  }

  public isBlocked(): boolean {
    return this.status === UserStatus.BLOCKED;
  }

  public changePassword(newHash: string, occurredAt: string, eventId: string): void {
    this.passwordHash = newHash;
    this.recordDomainEvent(
      new PasswordChangedDomainEvent(
        this.id,
        'UserAccount',
        { userId: this.id },
        occurredAt,
        eventId,
      ),
    );
  }

  public block(): void {
    if (this.status === UserStatus.BLOCKED) {
      return;
    }
    this.status = UserStatus.BLOCKED;
  }
}
export class UserAccountBlockedError extends Error {
  constructor() {
    super('The user account is blocked.');
  }
}
