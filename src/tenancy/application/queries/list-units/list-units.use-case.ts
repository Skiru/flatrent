import { RentalUnitRepository } from '../../ports/rental-unit.repository';
import { ListLandlordRentalUnitsQuery, RentalUnitReadModel } from './list-units.query';

export class ListLandlordRentalUnitsUseCase {
  constructor(private readonly rentalUnitRepository: RentalUnitRepository) {}

  public async execute(query: ListLandlordRentalUnitsQuery): Promise<RentalUnitReadModel[]> {
    const units = await this.rentalUnitRepository.findAllByOwnerId(query.landlordId);
    return units.map((unit) => ({
      id: unit.id,
      ownerId: unit.getOwnerId(),
      address: unit.getAddress(),
    }));
  }
}
