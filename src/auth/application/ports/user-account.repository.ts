import { UserAccount } from '../../domain/model/user-account.aggregate';
import { Email } from '../../domain/model/email.value-object';

export interface UserAccountRepository {
  findById(id: string, transactionalEntityManager?: unknown): Promise<UserAccount | null>;
  findByEmail(email: Email, transactionalEntityManager?: unknown): Promise<UserAccount | null>;
  save(user: UserAccount, transactionalEntityManager?: unknown): Promise<void>;
}
export const USER_ACCOUNT_REPOSITORY_TOKEN = 'UserAccountRepository';
