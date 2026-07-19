import { UserAccount, UserRole, UserStatus } from '../../domain/model/user-account.aggregate';
import { UserAccountEntity } from './user-account.entity';
import { Email } from '../../domain/model/email.value-object';

export class UserAccountMapper {
  public static toEntity(domain: UserAccount): UserAccountEntity {
    const entity = new UserAccountEntity();
    entity.id = domain.id;
    entity.email = domain.getEmail().value;
    entity.passwordHash = domain.getPasswordHash();
    entity.role = domain.getRole();
    entity.status = domain.getStatus();
    entity.version = domain.getVersion();
    return entity;
  }

  public static toDomain(entity: UserAccountEntity): UserAccount {
    const email = Email.create(entity.email);
    const domain = new UserAccount(
      entity.id,
      email,
      entity.passwordHash,
      entity.role as UserRole,
      entity.status as UserStatus,
    );
    domain.setVersion(entity.version);
    return domain;
  }
}
export const USER_ACCOUNT_MAPPER_TOKEN = 'UserAccountMapper';
