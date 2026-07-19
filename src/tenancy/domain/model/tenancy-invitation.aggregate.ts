import { AggregateRoot } from '../../../shared/domain/aggregate-root';

export enum InvitationStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

export class TenancyInvitation extends AggregateRoot<string> {
  private rentalUnitId: string;
  private tenantEmail: string;
  private expiresAt: Date;
  private status: InvitationStatus;

  constructor(
    id: string,
    rentalUnitId: string,
    tenantEmail: string,
    expiresAt: Date,
    status: InvitationStatus = InvitationStatus.PENDING,
  ) {
    super(id);
    this.rentalUnitId = rentalUnitId;
    this.tenantEmail = tenantEmail;
    this.expiresAt = expiresAt;
    this.status = status;
  }

  public getRentalUnitId(): string {
    return this.rentalUnitId;
  }

  public getTenantEmail(): string {
    return this.tenantEmail;
  }

  public getExpiresAt(): Date {
    return this.expiresAt;
  }

  public getStatus(): InvitationStatus {
    return this.status;
  }

  public isExpired(now: Date): boolean {
    return now.getTime() > this.expiresAt.getTime();
  }

  public accept(now: Date): void {
    if (this.status !== InvitationStatus.PENDING) {
      throw new Error(`Invitation is not pending, current status: ${this.status}`);
    }
    if (this.isExpired(now)) {
      this.status = InvitationStatus.EXPIRED;
      this.incrementVersion();
      throw new Error('Invitation has expired');
    }
    this.status = InvitationStatus.ACCEPTED;
    this.incrementVersion();
  }

  public reject(): void {
    if (this.status !== InvitationStatus.PENDING) {
      throw new Error(`Invitation is not pending, current status: ${this.status}`);
    }
    this.status = InvitationStatus.REJECTED;
    this.incrementVersion();
  }
}
