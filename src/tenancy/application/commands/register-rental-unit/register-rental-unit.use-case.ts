import { RentalUnit } from '../../../domain/model/rental-unit.aggregate';
import { RentalUnitRepository } from '../../ports/rental-unit.repository';
import {
  RegisterRentalUnitCommand,
  RegisterRentalUnitResult,
} from './register-rental-unit.command';

export class RegisterRentalUnitUseCase {
  constructor(private readonly rentalUnitRepository: RentalUnitRepository) {}

  public async execute(command: RegisterRentalUnitCommand): Promise<RegisterRentalUnitResult> {
    const existing = await this.rentalUnitRepository.findById(command.id);
    if (existing) {
      throw new Error('Rental unit already registered with this ID.');
    }

    const unit = new RentalUnit(command.id, command.ownerId, command.address);
    await this.rentalUnitRepository.save(unit);

    return {
      id: unit.id,
      ownerId: unit.getOwnerId(),
      address: unit.getAddress(),
    };
  }
}
export class RentalUnitNotFoundError extends Error {
  constructor() {
    super('The requested rental unit was not found.');
  }
}
