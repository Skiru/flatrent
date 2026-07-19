import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import { MaintenanceEmergencyPolicy } from '../policies/emergency.policy';

export enum MaintenanceStatus {
  OPENED = 'OPENED',
  SCHEDULED = 'SCHEDULED',
  RESOLVED = 'RESOLVED',
  REJECTED = 'REJECTED',
}

export class MaintenanceRequest extends AggregateRoot<string> {
  private rentalUnitId: string;
  private reporterId: string;
  private description: string;
  private status: MaintenanceStatus;
  private isEmergency: boolean;
  private assignedHandymanId: string | null;
  private visitDate: Date | null;
  private resolutionDescription: string | null;
  private isClosed: boolean;

  constructor(
    id: string,
    rentalUnitId: string,
    reporterId: string,
    description: string,
    status: MaintenanceStatus = MaintenanceStatus.OPENED,
    assignedHandymanId: string | null = null,
    visitDate: Date | null = null,
    resolutionDescription: string | null = null,
    isClosed: boolean = false,
  ) {
    super(id);
    this.rentalUnitId = rentalUnitId;
    this.reporterId = reporterId;
    this.description = description;
    this.status = status;
    this.isEmergency = MaintenanceEmergencyPolicy.isEmergency(description);
    this.assignedHandymanId = assignedHandymanId;
    this.visitDate = visitDate;
    this.resolutionDescription = resolutionDescription;
    this.isClosed = isClosed;
  }

  public getRentalUnitId(): string {
    return this.rentalUnitId;
  }

  public getReporterId(): string {
    return this.reporterId;
  }

  public getDescription(): string {
    return this.description;
  }

  public getStatus(): MaintenanceStatus {
    return this.status;
  }

  public getIsEmergency(): boolean {
    return this.isEmergency;
  }

  public getAssignedHandymanId(): string | null {
    return this.assignedHandymanId;
  }

  public getVisitDate(): Date | null {
    return this.visitDate;
  }

  public getResolutionDescription(): string | null {
    return this.resolutionDescription;
  }

  public getIsClosed(): boolean {
    return this.isClosed;
  }

  public scheduleVisit(visitDate: Date, handymanId: string): void {
    if (this.isClosed) {
      throw new Error('Maintenance request is closed and cannot be scheduled');
    }
    this.status = MaintenanceStatus.SCHEDULED;
    this.visitDate = visitDate;
    this.assignedHandymanId = handymanId;
    this.incrementVersion();
  }

  public resolve(description: string): void {
    if (this.isClosed) {
      throw new Error('Maintenance request is closed and cannot be resolved');
    }
    if (!description || description.trim().length === 0) {
      throw new Error('Resolution description cannot be empty');
    }
    this.status = MaintenanceStatus.RESOLVED;
    this.resolutionDescription = description;
    this.isClosed = true;
    this.incrementVersion();
  }

  public reject(): void {
    if (this.isClosed) {
      throw new Error('Maintenance request is closed and cannot be rejected');
    }
    this.status = MaintenanceStatus.REJECTED;
    this.isClosed = true;
    this.incrementVersion();
  }
}
