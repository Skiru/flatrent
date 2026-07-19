export class GetCurrentActorQuery {
  constructor(public readonly userId: string) {}
}

export interface ActorReadModel {
  readonly id: string;
  readonly email: string;
  readonly role: string;
  readonly status: string;
}
