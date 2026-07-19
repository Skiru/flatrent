import { RentalUnit } from '../../domain/model/rental-unit.aggregate';
import { RentalUnitEntity } from './rental-unit.entity';

export class RentalUnitMapper {
  public static toEntity(domain: RentalUnit): RentalUnitEntity {
    const entity = new RentalUnitEntity();
    entity.id = domain.id;
    entity.ownerId = domain.getOwnerId();
    entity.address = domain.getAddress();
    entity.version = domain.getVersion();
    return entity;
  }

  public static toDomain(entity: RentalUnitEntity): RentalUnit {
    const domain = new RentalUnit(entity.id, entity.ownerId, entity.address);
    domain.setVersion(entity.version);
    return domain;
  }
}
