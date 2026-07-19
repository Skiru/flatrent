export class LoginCommand {
  constructor(
    public readonly email: string,
    public readonly rawPassword: string,
  ) {}
}

export interface LoginResult {
  readonly userId: string;
  readonly role: string;
  readonly sessionId: string;
  readonly refreshToken: string;
}
export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid email or password.');
  }
}
