import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import {
  ListLandlordRentalUnitsQuery,
  RentalUnitReadModel,
} from '../../../application/queries/list-units/list-units.query';
import { ListLandlordRentalUnitsUseCase } from '../../../application/queries/list-units/list-units.use-case';

@QueryHandler(ListLandlordRentalUnitsQuery)
export class ListLandlordRentalUnitsNestHandler
  implements IQueryHandler<ListLandlordRentalUnitsQuery, RentalUnitReadModel[]>
{
  constructor(private readonly useCase: ListLandlordRentalUnitsUseCase) {}

  public async execute(query: ListLandlordRentalUnitsQuery): Promise<RentalUnitReadModel[]> {
    return this.useCase.execute(query);
  }
}
