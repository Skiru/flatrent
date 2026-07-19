import { UserAccountRepository } from '../../ports/user-account.repository';
import { PasswordHasher } from '../../ports/password-hasher.interface';
import {
  PasswordPolicy,
  PasswordDoesNotMeetPolicyError,
} from '../../../domain/policies/password.policy';
import {
  ChangePasswordCommand,
  OldPasswordInvalidError,
  UserNotFoundError,
} from './change-password.command';
import { Clock } from '../../../../shared/domain/clock.interface';
import { IdGenerator } from '../../../../shared/application/ports/id-generator.interface';

export class ChangePasswordUseCase {
  constructor(
    private readonly userRepository: UserAccountRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  public async execute(command: ChangePasswordCommand): Promise<void> {
    const user = await this.userRepository.findById(command.userId);
    if (!user) {
      throw new UserNotFoundError();
    }

    const oldPasswordMatches = await this.passwordHasher.compare(
      command.oldPassword,
      user.getPasswordHash(),
    );
    if (!oldPasswordMatches) {
      throw new OldPasswordInvalidError();
    }

    if (!PasswordPolicy.isSatisfiedBy(command.newPassword)) {
      throw new PasswordDoesNotMeetPolicyError();
    }

    const newHash = await this.passwordHasher.hash(command.newPassword);
    const eventId = this.idGenerator.generate();
    const occurredAt = this.clock.nowIso();

    user.changePassword(newHash, occurredAt, eventId);

    await this.userRepository.save(user);
  }
}
