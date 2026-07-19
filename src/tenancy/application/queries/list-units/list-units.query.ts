export class ListLandlordRentalUnitsQuery {
  constructor(public readonly landlordId: string) {}
}

export interface RentalUnitReadModel {
  readonly id: string;
  readonly ownerId: string;
  readonly address: string;
}
