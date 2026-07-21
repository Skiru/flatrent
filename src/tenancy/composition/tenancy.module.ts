import { Module, Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule, getEntityManagerToken } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

// Entities
import { RentalUnitEntity } from '../infrastructure/persistence/rental-unit.entity';
import { TenancyInvitationEntity } from '../infrastructure/persistence/tenancy-invitation.entity';
import { HandoverProtocolEntity } from '../infrastructure/persistence/handover-protocol.entity';
import { TenancyEntity } from '../infrastructure/persistence/tenancy.entity';
import { DomainEventJournalEntity } from '../infrastructure/persistence/domain-event-journal.entity';
import { LocalEventDispatchEntity } from '../infrastructure/persistence/local-event-dispatch.entity';
import { DomainReactionDeliveryEntity } from '../infrastructure/persistence/domain-reaction-delivery.entity';
import { IntegrationOutboxEntity } from '../infrastructure/persistence/integration-outbox.entity';
import { InboxEntity } from '../infrastructure/persistence/inbox.entity';

// Repository Ports
import { RENTAL_UNIT_REPOSITORY_TOKEN } from '../application/ports/rental-unit.repository';
import { TENANCY_INVITATION_REPOSITORY_TOKEN } from '../application/ports/tenancy-invitation.repository';
import { HANDOVER_PROTOCOL_REPOSITORY_TOKEN } from '../application/ports/handover-protocol.repository';
import { TENANCY_REPOSITORY_TOKEN } from '../application/ports/tenancy.repository';
import { UNIT_OF_WORK_TOKEN } from '../../shared/application/ports/unit-of-work.interface';
import { RENTAL_UNIT_READINESS_PORT_TOKEN } from '../application/ports/rental-unit-readiness.port';

// Repository Implementations
import { TypeOrmRentalUnitRepository } from '../infrastructure/persistence/typeorm-rental-unit.repository';
import { TypeOrmTenancyInvitationRepository } from '../infrastructure/persistence/typeorm-tenancy-invitation.repository';
import { TypeOrmHandoverProtocolRepository } from '../infrastructure/persistence/typeorm-handover-protocol.repository';
import { TypeOrmTenancyRepository } from '../infrastructure/persistence/typeorm-tenancy.repository';
import { TypeOrmUnitOfWork } from '../infrastructure/persistence/typeorm-unit-of-work';
import { TypeOrmRentalUnitReadinessAdapter } from '../infrastructure/persistence/typeorm-rental-unit-readiness.adapter';

// Shared
import { ID_GENERATOR_TOKEN } from '../../shared/application/ports/id-generator.interface';
import { UuidGenerator } from '../../shared/infrastructure/uuid-generator';
import { SystemClock } from '../../shared/infrastructure/system-clock';
import { SharedModule } from '../../shared/composition/shared.module';

// Use Cases
import { RegisterRentalUnitUseCase } from '../application/commands/register-rental-unit/register-rental-unit.use-case';
import { InviteTenantUseCase } from '../application/commands/invite-tenant/invite-tenant.use-case';
import { AcceptInvitationUseCase } from '../application/commands/accept-invitation/accept-invitation.use-case';
import { ConfirmHandoverUseCase } from '../application/commands/confirm-handover/confirm-handover.use-case';
import { ActivateTenancyUseCase } from '../application/commands/activate-tenancy/activate-tenancy.use-case';
import { GiveNoticeUseCase } from '../application/commands/give-notice/give-notice.use-case';
import { EndTenancyUseCase } from '../application/commands/end-tenancy/end-tenancy.use-case';
import { GetTenancyUseCase } from '../application/queries/get-tenancy/get-tenancy.use-case';
import { ListLandlordRentalUnitsUseCase } from '../application/queries/list-units/list-units.use-case';

// CQRS Handlers
import { RegisterRentalUnitNestHandler } from '../interfaces/cqrs/commands/register-rental-unit.handler';
import { InviteTenantNestHandler } from '../interfaces/cqrs/commands/invite-tenant.handler';
import { AcceptInvitationNestHandler } from '../interfaces/cqrs/commands/accept-invitation.handler';
import { ConfirmHandoverNestHandler } from '../interfaces/cqrs/commands/confirm-handover.handler';
import { ActivateTenancyNestHandler } from '../interfaces/cqrs/commands/activate-tenancy.handler';
import { GiveNoticeNestHandler } from '../interfaces/cqrs/commands/give-notice.handler';
import { EndTenancyNestHandler } from '../interfaces/cqrs/commands/end-tenancy.handler';
import { GetTenancyNestHandler } from '../interfaces/cqrs/queries/get-tenancy.handler';
import { ListLandlordRentalUnitsNestHandler } from '../interfaces/cqrs/queries/list-units.handler';
import { TenancyController } from '../interfaces/http/tenancy.controller';

const UseCaseProviders: Provider[] = [
  {
    provide: RegisterRentalUnitUseCase,
    useFactory: (repo) => new RegisterRentalUnitUseCase(repo),
    inject: [RENTAL_UNIT_REPOSITORY_TOKEN],
  },
  {
    provide: InviteTenantUseCase,
    useFactory: (invRepo, unitRepo) => new InviteTenantUseCase(invRepo, unitRepo),
    inject: [TENANCY_INVITATION_REPOSITORY_TOKEN, RENTAL_UNIT_REPOSITORY_TOKEN],
  },
  {
    provide: AcceptInvitationUseCase,
    useFactory: (invRepo, tenancyRepo, clock) =>
      new AcceptInvitationUseCase(invRepo, tenancyRepo, clock),
    inject: [TENANCY_INVITATION_REPOSITORY_TOKEN, TENANCY_REPOSITORY_TOKEN, SystemClock],
  },
  {
    provide: ConfirmHandoverUseCase,
    useFactory: (handoverRepo, tenancyRepo) =>
      new ConfirmHandoverUseCase(handoverRepo, tenancyRepo),
    inject: [HANDOVER_PROTOCOL_REPOSITORY_TOKEN, TENANCY_REPOSITORY_TOKEN],
  },
  {
    provide: ActivateTenancyUseCase,
    useFactory: (tenancyRepo, handoverRepo, readinessPort, idGen, clock) =>
      new ActivateTenancyUseCase(tenancyRepo, handoverRepo, readinessPort, idGen, clock),
    inject: [
      TENANCY_REPOSITORY_TOKEN,
      HANDOVER_PROTOCOL_REPOSITORY_TOKEN,
      RENTAL_UNIT_READINESS_PORT_TOKEN,
      ID_GENERATOR_TOKEN,
      SystemClock,
    ],
  },
  {
    provide: GiveNoticeUseCase,
    useFactory: (repo) => new GiveNoticeUseCase(repo),
    inject: [TENANCY_REPOSITORY_TOKEN],
  },
  {
    provide: EndTenancyUseCase,
    useFactory: (repo) => new EndTenancyUseCase(repo),
    inject: [TENANCY_REPOSITORY_TOKEN],
  },
  {
    provide: GetTenancyUseCase,
    useFactory: (repo) => new GetTenancyUseCase(repo),
    inject: [TENANCY_REPOSITORY_TOKEN],
  },
  {
    provide: ListLandlordRentalUnitsUseCase,
    useFactory: (repo) => new ListLandlordRentalUnitsUseCase(repo),
    inject: [RENTAL_UNIT_REPOSITORY_TOKEN],
  },
];

const RepositoryProviders: Provider[] = [
  {
    provide: RENTAL_UNIT_REPOSITORY_TOKEN,
    useFactory: (em: EntityManager) => new TypeOrmRentalUnitRepository(em),
    inject: [getEntityManagerToken('tenancy')],
  },
  {
    provide: TENANCY_INVITATION_REPOSITORY_TOKEN,
    useFactory: (em: EntityManager) => new TypeOrmTenancyInvitationRepository(em),
    inject: [getEntityManagerToken('tenancy')],
  },
  {
    provide: HANDOVER_PROTOCOL_REPOSITORY_TOKEN,
    useFactory: (em: EntityManager) => new TypeOrmHandoverProtocolRepository(em),
    inject: [getEntityManagerToken('tenancy')],
  },
  {
    provide: TENANCY_REPOSITORY_TOKEN,
    useFactory: (em: EntityManager) => new TypeOrmTenancyRepository(em),
    inject: [getEntityManagerToken('tenancy')],
  },
  {
    provide: UNIT_OF_WORK_TOKEN,
    useFactory: (em: EntityManager) => new TypeOrmUnitOfWork(em),
    inject: [getEntityManagerToken('tenancy')],
  },
  {
    provide: RENTAL_UNIT_READINESS_PORT_TOKEN,
    useFactory: (em: EntityManager) => new TypeOrmRentalUnitReadinessAdapter(em),
    inject: [getEntityManagerToken('tenancy')],
  },
];

const SharedProviders: Provider[] = [
  {
    provide: ID_GENERATOR_TOKEN,
    useClass: UuidGenerator,
  },
  SystemClock,
];

const CQRSHandlers = [
  RegisterRentalUnitNestHandler,
  InviteTenantNestHandler,
  AcceptInvitationNestHandler,
  ConfirmHandoverNestHandler,
  ActivateTenancyNestHandler,
  GiveNoticeNestHandler,
  EndTenancyNestHandler,
  GetTenancyNestHandler,
  ListLandlordRentalUnitsNestHandler,
];

@Module({
  imports: [
    CqrsModule,
    SharedModule,
    TypeOrmModule.forFeature(
      [
        RentalUnitEntity,
        TenancyInvitationEntity,
        HandoverProtocolEntity,
        TenancyEntity,
        DomainEventJournalEntity,
        LocalEventDispatchEntity,
        DomainReactionDeliveryEntity,
        IntegrationOutboxEntity,
        InboxEntity,
      ],
      'tenancy', // bound to Named Connection 'tenancy'
    ),
  ],
  controllers: [TenancyController],
  providers: [...UseCaseProviders, ...RepositoryProviders, ...SharedProviders, ...CQRSHandlers],
})
export class TenancyModule {}
