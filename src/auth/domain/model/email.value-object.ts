import { ValueObject } from '../../../shared/domain/value-object';

export class Email extends ValueObject<string> {
  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  private constructor(value: string) {
    super(value);
  }

  public static create(value: string): Email {
    if (!value) {
      throw new Error('Email cannot be empty');
    }
    const normalized = value.trim().toLowerCase();
    if (!this.EMAIL_REGEX.test(normalized)) {
      throw new Error(`Invalid email format: ${value}`);
    }
    return new Email(normalized);
  }
}
