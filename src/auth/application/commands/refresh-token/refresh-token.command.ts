export class RefreshTokenCommand {
  constructor(
    public readonly sessionId: string,
    public readonly refreshToken: string,
  ) {}
}

export interface RefreshTokenResult {
  readonly userId: string;
  readonly role: string;
  readonly nextRefreshToken: string;
}
export class SessionNotFoundError extends Error {
  constructor() {
    super('The requested refresh session was not found.');
  }
}
