import { RefreshSessionRepository } from '../../ports/refresh-session.repository';
import { UserAccountRepository } from '../../ports/user-account.repository';
import { PasswordHasher } from '../../ports/password-hasher.interface';
import {
  RefreshTokenCommand,
  RefreshTokenResult,
  SessionNotFoundError,
} from './refresh-token.command';
import { Clock } from '../../../../shared/domain/clock.interface';
import { IdGenerator } from '../../../../shared/application/ports/id-generator.interface';
import { RefreshSessionExpiredError } from '../../../domain/model/refresh-session.entity';

export class RefreshTokenUseCase {
  constructor(
    private readonly sessionRepository: RefreshSessionRepository,
    private readonly userRepository: UserAccountRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  public async execute(command: RefreshTokenCommand): Promise<RefreshTokenResult> {
    const session = await this.sessionRepository.findById(command.sessionId);
    if (!session) {
      throw new SessionNotFoundError();
    }

    const now = this.clock.now();
    if (session.isExpired(now)) {
      session.revoke();
      await this.sessionRepository.save(session);
      throw new RefreshSessionExpiredError();
    }

    // Verify token hash
    // We compare hash of submitted token with current active hash in DB
    const submittedHash = await this.passwordHasher.hash(command.refreshToken);
    try {
      session.verifyTokenHash(submittedHash);
    } catch (error) {
      // Save updated revoked status to database on reuse detection
      await this.sessionRepository.save(session);
      throw error;
    }

    const nextRefreshToken = this.idGenerator.generate();
    const nextHash = await this.passwordHasher.hash(nextRefreshToken);
    const expiresAt = new Date(now.getTime() + 86400000 * 30); // 30 days

    session.rotate(nextHash, expiresAt);
    await this.sessionRepository.save(session);

    const user = await this.userRepository.findById(session.getUserId());
    if (!user) {
      throw new Error('Associated user not found.');
    }

    return {
      userId: user.id,
      role: user.getRole(),
      nextRefreshToken,
    };
  }
}
