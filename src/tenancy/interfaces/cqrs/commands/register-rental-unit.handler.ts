import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  RegisterRentalUnitCommand,
  RegisterRentalUnitResult,
} from '../../../application/commands/register-rental-unit/register-rental-unit.command';
import { RegisterRentalUnitUseCase } from '../../../application/commands/register-rental-unit/register-rental-unit.use-case';

@CommandHandler(RegisterRentalUnitCommand)
export class RegisterRentalUnitNestHandler
  implements ICommandHandler<RegisterRentalUnitCommand, RegisterRentalUnitResult>
{
  constructor(private readonly useCase: RegisterRentalUnitUseCase) {}

  public async execute(command: RegisterRentalUnitCommand): Promise<RegisterRentalUnitResult> {
    return this.useCase.execute(command);
  }
}
