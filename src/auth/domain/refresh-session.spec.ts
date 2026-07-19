import {
  RefreshSession,
  RefreshSessionRevokedError,
  RefreshSessionTokenReuseDetectedError,
} from './model/refresh-session.entity';

describe('RefreshSession Aggregate', () => {
  it('should initialize active session, rotate successfully, and detect reuse', () => {
    const expiresAt = new Date(Date.now() + 3600000);
    const session = new RefreshSession('session-1', 'user-1', 'hash-initial', expiresAt);

    expect(session.getIsRevoked()).toBe(false);

    // Rotate successfully
    const nextExpires = new Date(Date.now() + 7200000);
    session.rotate('hash-next', nextExpires);
    expect(session.getTokenHash()).toBe('hash-next');

    // Mismatched token verification (reuse/hijack check)
    expect(() => session.verifyToken(false)).toThrow(RefreshSessionTokenReuseDetectedError);
    expect(session.getIsRevoked()).toBe(true); // Family revoked!
  });

  it('should fail rotation if the session is already revoked', () => {
    const session = new RefreshSession('session-1', 'user-1', 'hash-1', new Date());
    session.revoke();

    expect(() => session.rotate('hash-2', new Date())).toThrow(RefreshSessionRevokedError);
  });
});
