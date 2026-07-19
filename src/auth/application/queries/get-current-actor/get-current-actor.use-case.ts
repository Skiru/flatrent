import { UserAccountRepository } from '../../ports/user-account.repository';
import { GetCurrentActorQuery, ActorReadModel } from './get-current-actor.query';
import { UserNotFoundError } from '../../commands/change-password/change-password.command';

export class GetCurrentActorUseCase {
  constructor(private readonly userRepository: UserAccountRepository) {}

  public async execute(query: GetCurrentActorQuery): Promise<ActorReadModel> {
    const user = await this.userRepository.findById(query.userId);
    if (!user) {
      throw new UserNotFoundError();
    }

    return {
      id: user.id,
      email: user.getEmail().value,
      role: user.getRole(),
      status: user.getStatus(),
    };
  }
}
