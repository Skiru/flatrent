import { Email } from '../../../domain/model/email.value-object';
import { UserAccountBlockedError } from '../../../domain/model/user-account.aggregate';
import { RefreshSession } from '../../../domain/model/refresh-session.entity';
import { UserAccountRepository } from '../../ports/user-account.repository';
import { RefreshSessionRepository } from '../../ports/refresh-session.repository';
import { PasswordHasher } from '../../ports/password-hasher.interface';
import { LoginCommand, LoginResult, InvalidCredentialsError } from './login.command';
import { Clock } from '../../../../shared/domain/clock.interface';
import { IdGenerator } from '../../../../shared/application/ports/id-generator.interface';

export class LoginUseCase {
  constructor(
    private readonly userRepository: UserAccountRepository,
    private readonly sessionRepository: RefreshSessionRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  public async execute(command: LoginCommand): Promise<LoginResult> {
    const email = Email.create(command.email);
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new InvalidCredentialsError();
    }

    if (user.isBlocked()) {
      throw new UserAccountBlockedError();
    }

    const passwordMatches = await this.passwordHasher.compare(
      command.rawPassword,
      user.getPasswordHash(),
    );
    if (!passwordMatches) {
      throw new InvalidCredentialsError();
    }

    const sessionId = this.idGenerator.generate();
    const refreshToken = this.idGenerator.generate(); // Secure random string
    // In our implementation, we'll hash the refresh token using SHA-256 for DB storage
    const tokenHash = await this.passwordHasher.hash(refreshToken);
    const expiresAt = new Date(this.clock.now().getTime() + 86400000 * 30); // 30 days

    const session = new RefreshSession(sessionId, user.id, tokenHash, expiresAt);
    await this.sessionRepository.save(session);

    return {
      userId: user.id,
      role: user.getRole(),
      sessionId,
      refreshToken,
    };
  }
}
