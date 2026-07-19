export class PasswordPolicy {
  private static readonly MIN_LENGTH = 8;

  public static isSatisfiedBy(password: string): boolean {
    if (!password) {
      return false;
    }
    if (password.length < this.MIN_LENGTH) {
      return false;
    }
    // Simple check: has at least one letter and one number
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    return hasLetter && hasNumber;
  }
}
export class PasswordDoesNotMeetPolicyError extends Error {
  constructor() {
    super(
      'Password does not meet safety standards (min 8 characters, containing letters and numbers).',
    );
  }
}
