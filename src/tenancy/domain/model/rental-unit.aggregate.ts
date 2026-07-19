import { AggregateRoot } from '../../../shared/domain/aggregate-root';

export class RentalUnit extends AggregateRoot<string> {
  private ownerId: string;
  private address: string;

  constructor(id: string, ownerId: string, address: string) {
    super(id);
    this.ownerId = ownerId;
    this.address = address;
  }

  public getOwnerId(): string {
    return this.ownerId;
  }

  public getAddress(): string {
    return this.address;
  }
}
