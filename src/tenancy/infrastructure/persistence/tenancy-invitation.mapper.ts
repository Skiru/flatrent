import {
  TenancyInvitation,
  InvitationStatus,
} from '../../domain/model/tenancy-invitation.aggregate';
import { TenancyInvitationEntity } from './tenancy-invitation.entity';

export class TenancyInvitationMapper {
  public static toEntity(domain: TenancyInvitation): TenancyInvitationEntity {
    const entity = new TenancyInvitationEntity();
    entity.id = domain.id;
    entity.rentalUnitId = domain.getRentalUnitId();
    entity.tenantEmail = domain.getTenantEmail();
    entity.expiresAt = domain.getExpiresAt();
    entity.status = domain.getStatus();
    entity.version = domain.getVersion();
    return entity;
  }

  public static toDomain(entity: TenancyInvitationEntity): TenancyInvitation {
    const domain = new TenancyInvitation(
      entity.id,
      entity.rentalUnitId,
      entity.tenantEmail,
      entity.expiresAt,
      entity.status as InvitationStatus,
    );
    domain.setVersion(entity.version);
    return domain;
  }
}
