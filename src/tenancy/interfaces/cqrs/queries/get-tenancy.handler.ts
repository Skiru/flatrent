import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import {
  GetTenancyQuery,
  TenancyReadModel,
} from '../../../application/queries/get-tenancy/get-tenancy.query';
import { GetTenancyUseCase } from '../../../application/queries/get-tenancy/get-tenancy.use-case';

@QueryHandler(GetTenancyQuery)
export class GetTenancyNestHandler implements IQueryHandler<GetTenancyQuery, TenancyReadModel> {
  constructor(private readonly useCase: GetTenancyUseCase) {}

  public async execute(query: GetTenancyQuery): Promise<TenancyReadModel> {
    return this.useCase.execute(query);
  }
}
