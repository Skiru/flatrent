export class ConfirmHandoverCommand {
  constructor(
    public readonly id: string,
    public readonly tenancyId: string,
    public readonly meterReadings: Record<string, number>,
    public readonly checklist: Record<string, boolean>,
  ) {}
}

export interface ConfirmHandoverResult {
  readonly id: string;
  readonly tenancyId: string;
  readonly isClosed: boolean;
}
export class TenancyNotFoundError extends Error {
  constructor() {
    super('The requested tenancy was not found.');
  }
}
/** @internal */
export class HandoverProtocolAlreadyClosedError extends Error {
  constructor() {
    super('The handover protocol is already closed.');
  }
}
