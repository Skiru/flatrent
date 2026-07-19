import { TenancyRepository } from '../../ports/tenancy.repository';
import { HandoverProtocolRepository } from '../../ports/handover-protocol.repository';
import { RentalUnitReadinessPort } from '../../ports/rental-unit-readiness.port';
import { ActivateTenancyCommand, ActivateTenancyResult } from './activate-tenancy.command';
import { HandoverProtocolNotFoundError } from '../confirm-handover/confirm-handover.use-case';
import { TenancyNotFoundError } from '../confirm-handover/confirm-handover.command';
import { Clock } from '../../../../shared/domain/clock.interface';
import { IdGenerator } from '../../../../shared/application/ports/id-generator.interface';

export class ActivateTenancyUseCase {
  constructor(
    private readonly tenancyRepository: TenancyRepository,
    private readonly handoverRepository: HandoverProtocolRepository,
    private readonly readinessPort: RentalUnitReadinessPort,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  public async execute(command: ActivateTenancyCommand): Promise<ActivateTenancyResult> {
    const tenancy = await this.tenancyRepository.findById(command.tenancyId);
    if (!tenancy) {
      throw new TenancyNotFoundError();
    }

    // Fail-closed readiness and gap check before activating the lease
    await this.readinessPort.assertReadyToLease(tenancy.getRentalUnitId());

    const handover = await this.handoverRepository.findById(command.handoverProtocolId);
    if (!handover) {
      throw new HandoverProtocolNotFoundError();
    }

    const eventId = this.idGenerator.generate();
    const occurredAt = this.clock.nowIso();

    tenancy.activate(handover, occurredAt, eventId);

    await this.tenancyRepository.save(tenancy);

    return {
      tenancyId: tenancy.id,
      status: tenancy.getStatus(),
    };
  }
}
