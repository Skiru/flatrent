export interface ActorSnapshot {
  readonly id: string;
  readonly email: string;
  readonly role: string;
  readonly status: string;
}

export interface AuthModuleApi {
  authenticateAccessToken(token: string): Promise<ActorSnapshot>;
  getActorSnapshot(userId: string): Promise<ActorSnapshot>;
}

export const AUTH_MODULE_API_TOKEN = 'AuthModuleApi';
