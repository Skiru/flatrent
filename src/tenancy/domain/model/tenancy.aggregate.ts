import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import { HandoverProtocol } from './handover-protocol.aggregate';
import { TenancyActivatedDomainEvent } from '../events/tenancy-activated.event';

export enum TenancyStatus {
  RESERVED = 'RESERVED',
  ACTIVE = 'ACTIVE',
  ENDED = 'ENDED',
  TERMINATED = 'TERMINATED',
}

export class Tenancy extends AggregateRoot<string> {
  private rentalUnitId: string;
  private tenantId: string;
  private startDate: Date;
  private endDate: Date;
  private status: TenancyStatus;
  private noticeDate: Date | null;

  constructor(
    id: string,
    rentalUnitId: string,
    tenantId: string,
    startDate: Date,
    endDate: Date,
    status: TenancyStatus = TenancyStatus.RESERVED,
    noticeDate: Date | null = null,
  ) {
    super(id);
    if (startDate.getTime() > endDate.getTime()) {
      throw new Error('Start date must be before or equal to end date');
    }
    this.rentalUnitId = rentalUnitId;
    this.tenantId = tenantId;
    this.startDate = startDate;
    this.endDate = endDate;
    this.status = status;
    this.noticeDate = noticeDate;
  }

  public getRentalUnitId(): string {
    return this.rentalUnitId;
  }

  public getTenantId(): string {
    return this.tenantId;
  }

  public getStartDate(): Date {
    return this.startDate;
  }

  public getEndDate(): Date {
    return this.endDate;
  }

  public getStatus(): TenancyStatus {
    return this.status;
  }

  public getNoticeDate(): Date | null {
    return this.noticeDate;
  }

  public activate(handover: HandoverProtocol, occurredAt: string, eventId: string): void {
    if (this.status !== TenancyStatus.RESERVED) {
      throw new Error(
        `Tenancy can only be activated from RESERVED state, current status: ${this.status}`,
      );
    }
    if (handover.getTenancyId() !== this.id) {
      throw new Error('Handover protocol does not match this tenancy');
    }
    if (!handover.getIsClosed()) {
      throw new Error('Handover protocol must be closed before tenancy activation');
    }

    this.status = TenancyStatus.ACTIVE;
    this.incrementVersion();

    this.recordDomainEvent(
      new TenancyActivatedDomainEvent(
        this.id,
        'Tenancy',
        {
          rentalUnitId: this.rentalUnitId,
          tenantId: this.tenantId,
          startDate: this.startDate.toISOString(),
          endDate: this.endDate.toISOString(),
        },
        occurredAt,
        eventId,
        this.getVersion(),
      ),
    );
  }

  public giveNotice(noticeDate: Date): void {
    if (this.status !== TenancyStatus.ACTIVE) {
      throw new Error(
        `Notice can only be given for ACTIVE tenancy, current status: ${this.status}`,
      );
    }
    this.status = TenancyStatus.TERMINATED;
    this.noticeDate = noticeDate;
    this.incrementVersion();
  }

  public end(): void {
    if (this.status !== TenancyStatus.ACTIVE && this.status !== TenancyStatus.TERMINATED) {
      throw new Error(
        `Tenancy can only be ended from ACTIVE or TERMINATED state, current status: ${this.status}`,
      );
    }
    this.status = TenancyStatus.ENDED;
    this.incrementVersion();
  }
}
export class TenancyDatesOverlapError extends Error {
  constructor() {
    super('This rental unit is already occupied or reserved during the requested dates.');
  }
}
