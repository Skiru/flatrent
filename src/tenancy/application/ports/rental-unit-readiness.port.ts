export interface RentalUnitReadinessPort {
  /**
   * Asserts whether a rental unit is ready to be leased.
   * Throws ReadinessProjectionStale if a background event gap is detected (fail-closed).
   * Throws RentalUnitNotReadyError if a blocking repair request is currently active.
   */
  assertReadyToLease(rentalUnitId: string, transactionalEntityManager?: unknown): Promise<void>;
}

export class ReadinessProjectionStale extends Error {
  constructor() {
    super(
      'The readiness projection is stale due to a detected background message gap. Fail-closed block active.',
    );
  }
}

export class RentalUnitNotReadyError extends Error {
  constructor() {
    super('The rental unit has an active blocking maintenance issue and cannot be leased.');
  }
}
export const RENTAL_UNIT_READINESS_PORT_TOKEN = 'RentalUnitReadinessPort';
