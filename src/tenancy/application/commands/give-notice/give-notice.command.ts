export class GiveNoticeCommand {
  constructor(
    public readonly tenancyId: string,
    public readonly noticeDate: Date,
  ) {}
}

export interface GiveNoticeResult {
  readonly tenancyId: string;
  readonly status: string;
}
