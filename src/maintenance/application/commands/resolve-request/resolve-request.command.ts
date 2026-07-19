export class ResolveRequestCommand {
  constructor(
    public readonly requestId: string,
    public readonly resolutionDescription: string,
  ) {}
}

export interface ResolveRequestResult {
  readonly id: string;
  readonly status: string;
  readonly isClosed: boolean;
}
