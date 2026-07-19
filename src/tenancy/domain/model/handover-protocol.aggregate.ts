import { AggregateRoot } from '../../../shared/domain/aggregate-root';

export class HandoverProtocol extends AggregateRoot<string> {
  private tenancyId: string;
  private meterReadings: Record<string, number>;
  private checklist: Record<string, boolean>;
  private isClosed: boolean;

  constructor(
    id: string,
    tenancyId: string,
    meterReadings: Record<string, number> = {},
    checklist: Record<string, boolean> = {},
    isClosed: boolean = false,
  ) {
    super(id);
    this.tenancyId = tenancyId;
    this.meterReadings = { ...meterReadings };
    this.checklist = { ...checklist };
    this.isClosed = isClosed;
  }

  public getTenancyId(): string {
    return this.tenancyId;
  }

  public getMeterReadings(): Record<string, number> {
    return { ...this.meterReadings };
  }

  public getChecklist(): Record<string, boolean> {
    return { ...this.checklist };
  }

  public getIsClosed(): boolean {
    return this.isClosed;
  }

  public recordMeterReading(key: string, value: number): void {
    if (this.isClosed) {
      throw new Error('Handover protocol is closed and cannot be modified');
    }
    if (value < 0) {
      throw new Error('Meter reading cannot be negative');
    }
    this.meterReadings[key] = value;
    this.incrementVersion();
  }

  public recordChecklistItem(key: string, checked: boolean): void {
    if (this.isClosed) {
      throw new Error('Handover protocol is closed and cannot be modified');
    }
    this.checklist[key] = checked;
    this.incrementVersion();
  }

  public close(): void {
    if (this.isClosed) {
      return;
    }
    this.isClosed = true;
    this.incrementVersion();
  }
}
