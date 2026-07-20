import { Email } from './model/email.value-object';
import { PasswordPolicy } from './policies/password.policy';
import {
  UserAccount,
  UserRole,
  UserStatus,
  UserRegisteredPayload,
} from './model/user-account.aggregate';

describe('UserAccount Aggregate Root', () => {
  it('should normalize and validate email addresses', () => {
    const validEmail = Email.create('  LANDLORD@flatren.com  ');
    expect(validEmail.value).toBe('landlord@flatren.com');

    expect(() => Email.create('invalid-email')).toThrow('Invalid email format');
    expect(() => Email.create('')).toThrow('Email cannot be empty');
  });

  it('should enforce password complexity guidelines through policy', () => {
    expect(PasswordPolicy.isSatisfiedBy('Short1')).toBe(false); // under 8 chars
    expect(PasswordPolicy.isSatisfiedBy('nonumbers')).toBe(false); // no numbers
    expect(PasswordPolicy.isSatisfiedBy('12345678')).toBe(false); // no letters
    expect(PasswordPolicy.isSatisfiedBy('SecurePassword123')).toBe(true);
  });

  it('should record UserRegisteredDomainEvent upon registration', () => {
    const email = Email.create('user@flatren.com');
    const user = UserAccount.register(
      'user-123',
      email,
      'hashedpassword123',
      UserRole.TENANT,
      'event-789',
      '2026-07-19T00:00:00Z',
    );

    expect(user.id).toBe('user-123');
    expect(user.getEmail().equals(email)).toBe(true);
    expect(user.getStatus()).toBe(UserStatus.ACTIVE);

    const events = user.peekPendingDomainEvents();
    expect(events.length).toBe(1);
    expect(events[0].eventType).toBe('UserRegisteredDomainEvent');
    expect((events[0].payload as UserRegisteredPayload).email).toBe('user@flatren.com');
  });

  it('should support blocking and correctly track aggregate versioning', () => {
    const email = Email.create('user@flatren.com');
    const user = UserAccount.register(
      'user-123',
      email,
      'hashedpassword123',
      UserRole.TENANT,
      'event-789',
      '2026-07-19T00:00:00Z',
    );

    expect(user.getVersion()).toBe(0);
    user.block();
    expect(user.getStatus()).toBe(UserStatus.BLOCKED);
    expect(user.isBlocked()).toBe(true);
    expect(user.getVersion()).toBe(1); // Managed by domain root upon mutation
  });
});
