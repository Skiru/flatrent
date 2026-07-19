export class ScheduleVisitCommand {
  constructor(
    public readonly requestId: string,
    public readonly visitDate: Date,
    public readonly handymanId: string,
  ) {}
}

export interface ScheduleVisitResult {
  readonly id: string;
  readonly status: string;
  readonly visitDate: string;
}
