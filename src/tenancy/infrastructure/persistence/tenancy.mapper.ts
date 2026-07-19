import { Tenancy, TenancyStatus } from '../../domain/model/tenancy.aggregate';
import { TenancyEntity } from './tenancy.entity';

export class TenancyMapper {
  public static toEntity(domain: Tenancy): TenancyEntity {
    const entity = new TenancyEntity();
    entity.id = domain.id;
    entity.rentalUnitId = domain.getRentalUnitId();
    entity.tenantId = domain.getTenantId();
    entity.startDate = domain.getStartDate();
    entity.endDate = domain.getEndDate();
    entity.status = domain.getStatus();
    entity.noticeDate = domain.getNoticeDate();
    entity.version = domain.getVersion();
    return entity;
  }

  public static toDomain(entity: TenancyEntity): Tenancy {
    const domain = new Tenancy(
      entity.id,
      entity.rentalUnitId,
      entity.tenantId,
      entity.startDate,
      entity.endDate,
      entity.status as TenancyStatus,
      entity.noticeDate,
    );
    domain.setVersion(entity.version);
    return domain;
  }
}
