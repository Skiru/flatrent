import { Email } from '../../../domain/model/email.value-object';
import {
  PasswordPolicy,
  PasswordDoesNotMeetPolicyError,
} from '../../../domain/policies/password.policy';
import { UserAccount } from '../../../domain/model/user-account.aggregate';
import { UserAccountRepository } from '../../ports/user-account.repository';
import { PasswordHasher } from '../../ports/password-hasher.interface';
import { RegisterUserCommand, RegisterUserResult } from './register-user.command';
import { Clock } from '../../../../shared/domain/clock.interface';
import { IdGenerator } from '../../../../shared/application/ports/id-generator.interface';

export class RegisterUserUseCase {
  constructor(
    private readonly userRepository: UserAccountRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  public async execute(command: RegisterUserCommand): Promise<RegisterUserResult> {
    const email = Email.create(command.email);

    const existing = await this.userRepository.findByEmail(email);
    if (existing) {
      throw new Error('User with this email already exists');
    }

    if (!PasswordPolicy.isSatisfiedBy(command.password)) {
      throw new PasswordDoesNotMeetPolicyError();
    }

    const passwordHash = await this.passwordHasher.hash(command.password);
    const eventId = this.idGenerator.generate();
    const occurredAt = this.clock.nowIso();

    const user = UserAccount.register(
      command.id,
      email,
      passwordHash,
      command.role,
      eventId,
      occurredAt,
    );

    await this.userRepository.save(user);

    return {
      id: user.id,
      email: user.getEmail().value,
    };
  }
}
