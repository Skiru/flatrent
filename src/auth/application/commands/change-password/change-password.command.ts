export class ChangePasswordCommand {
  constructor(
    public readonly userId: string,
    public readonly oldPassword: string,
    public readonly newPassword: string,
  ) {}
}

export class OldPasswordInvalidError extends Error {
  constructor() {
    super('The current password provided is invalid.');
  }
}
export class UserNotFoundError extends Error {
  constructor() {
    super('User account not found.');
  }
}
