import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import {
  GetCurrentActorQuery,
  ActorReadModel,
} from '../../../application/queries/get-current-actor/get-current-actor.query';
import { GetCurrentActorUseCase } from '../../../application/queries/get-current-actor/get-current-actor.use-case';

@QueryHandler(GetCurrentActorQuery)
export class GetCurrentActorNestHandler
  implements IQueryHandler<GetCurrentActorQuery, ActorReadModel>
{
  constructor(private readonly useCase: GetCurrentActorUseCase) {}

  public async execute(query: GetCurrentActorQuery): Promise<ActorReadModel> {
    return this.useCase.execute(query);
  }
}
