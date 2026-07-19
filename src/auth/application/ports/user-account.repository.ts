import { UserAccount } from '../../domain/model/user-account.aggregate';
import { Email } from '../../domain/model/email.value-object';
import { SaveOptions } from '../../../shared/application/ports/save-options.interface';

export interface UserAccountRepository {
  findById(id: string, transactionalEntityManager?: unknown): Promise<UserAccount | null>;
  findByEmail(email: Email, transactionalEntityManager?: unknown): Promise<UserAccount | null>;
  save(user: UserAccount, options?: SaveOptions): Promise<void>;
}
export const USER_ACCOUNT_REPOSITORY_TOKEN = 'UserAccountRepository';
