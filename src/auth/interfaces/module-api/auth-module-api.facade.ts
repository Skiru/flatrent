import { Injectable, Inject } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { AuthModuleApi, ActorSnapshot } from '../../public/contract/auth-module-api.interface';
import { JwtVerifier, JWT_VERIFIER_TOKEN } from '../../application/ports/jwt-verifier.interface';
import { GetCurrentActorQuery } from '../../application/queries/get-current-actor/get-current-actor.query';

@Injectable()
export class AuthModuleApiFacade implements AuthModuleApi {
  constructor(
    private readonly queryBus: QueryBus,
    @Inject(JWT_VERIFIER_TOKEN)
    private readonly jwtVerifier: JwtVerifier,
  ) {}

  public async authenticateAccessToken(token: string): Promise<ActorSnapshot> {
    const payload = await this.jwtVerifier.verifyAccessToken(token);
    return this.getActorSnapshot(payload.sub);
  }

  public async getActorSnapshot(userId: string): Promise<ActorSnapshot> {
    return this.queryBus.execute(new GetCurrentActorQuery(userId));
  }
}
