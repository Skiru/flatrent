import { AggregateRoot } from '../../../shared/domain/aggregate-root';

export class RefreshSession extends AggregateRoot<string> {
  private userId: string;
  private tokenHash: string;
  private expiresAt: Date;
  private isRevoked: boolean;

  constructor(
    id: string,
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    isRevoked: boolean = false,
  ) {
    super(id);
    this.userId = userId;
    this.tokenHash = tokenHash;
    this.expiresAt = expiresAt;
    this.isRevoked = isRevoked;
  }

  public getUserId(): string {
    return this.userId;
  }

  public getTokenHash(): string {
    return this.tokenHash;
  }

  public getExpiresAt(): Date {
    return this.expiresAt;
  }

  public getIsRevoked(): boolean {
    return this.isRevoked;
  }

  public isExpired(now: Date): boolean {
    return now.getTime() > this.expiresAt.getTime();
  }

  public rotate(newTokenHash: string, newExpiresAt: Date): void {
    if (this.isRevoked) {
      throw new RefreshSessionRevokedError();
    }
    this.tokenHash = newTokenHash;
    this.expiresAt = newExpiresAt;
    this.incrementVersion();
  }

  public revoke(): void {
    this.isRevoked = true;
    this.incrementVersion();
  }

  public verifyTokenHash(hash: string): void {
    if (this.isRevoked) {
      throw new RefreshSessionTokenReuseDetectedError();
    }
    if (this.tokenHash !== hash) {
      // Re-use detected! If the hashes mismatch but we attempt to use this session,
      // it means an older token is being submitted. Revoke immediately.
      this.revoke();
      throw new RefreshSessionTokenReuseDetectedError();
    }
  }
}

export class RefreshSessionRevokedError extends Error {
  constructor() {
    super('The refresh session has been revoked.');
  }
}

export class RefreshSessionTokenReuseDetectedError extends Error {
  constructor() {
    super('Token reuse detected! Revoking the session family to prevent unauthorized access.');
  }
}
export class RefreshSessionExpiredError extends Error {
  constructor() {
    super('The refresh session has expired.');
  }
}
