import { UserRole } from '../../../domain/model/user-account.aggregate';

export class RegisterUserCommand {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly password: string,
    public readonly role: UserRole,
  ) {}
}
export interface RegisterUserResult {
  readonly id: string;
  readonly email: string;
}
