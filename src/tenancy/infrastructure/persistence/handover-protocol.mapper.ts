import { HandoverProtocol } from '../../domain/model/handover-protocol.aggregate';
import { HandoverProtocolEntity } from './handover-protocol.entity';

export class HandoverProtocolMapper {
  public static toEntity(domain: HandoverProtocol): HandoverProtocolEntity {
    const entity = new HandoverProtocolEntity();
    entity.id = domain.id;
    entity.tenancyId = domain.getTenancyId();
    entity.meterReadings = domain.getMeterReadings();
    entity.checklist = domain.getChecklist();
    entity.isClosed = domain.getIsClosed();
    entity.version = domain.getVersion();
    return entity;
  }

  public static toDomain(entity: HandoverProtocolEntity): HandoverProtocol {
    const domain = new HandoverProtocol(
      entity.id,
      entity.tenancyId,
      entity.meterReadings,
      entity.checklist,
      entity.isClosed,
    );
    domain.setVersion(entity.version);
    return domain;
  }
}
