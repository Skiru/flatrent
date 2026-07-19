import { Controller, Post, Get, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { z } from 'zod';
import { RegisterRentalUnitCommand } from '../../application/commands/register-rental-unit/register-rental-unit.command';
import { InviteTenantCommand } from '../../application/commands/invite-tenant/invite-tenant.command';
import { AcceptInvitationCommand } from '../../application/commands/accept-invitation/accept-invitation.command';
import { ConfirmHandoverCommand } from '../../application/commands/confirm-handover/confirm-handover.command';
import { ActivateTenancyCommand } from '../../application/commands/activate-tenancy/activate-tenancy.command';
import { GetTenancyQuery } from '../../application/queries/get-tenancy/get-tenancy.query';
import { ListLandlordRentalUnitsQuery } from '../../application/queries/list-units/list-units.query';

const RegisterUnitSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().uuid(),
  address: z.string().min(5),
});

const InviteTenantSchema = z.object({
  id: z.string().uuid(),
  rentalUnitId: z.string().uuid(),
  tenantEmail: z.string().email(),
  expiresAt: z.string().datetime(),
});

const AcceptInvitationSchema = z.object({
  invitationId: z.string().uuid(),
  tenantId: z.string().uuid(),
  tenancyId: z.string().uuid(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

const ConfirmHandoverSchema = z.object({
  id: z.string().uuid(),
  tenancyId: z.string().uuid(),
  meterReadings: z.record(z.string(), z.number().nonnegative()),
  checklist: z.record(z.string(), z.boolean()),
});

const ActivateTenancySchema = z.object({
  handoverProtocolId: z.string().uuid(),
});

@Controller('api/v1/tenancies')
export class TenancyController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post('register-unit')
  @HttpCode(HttpStatus.CREATED)
  public async registerUnit(@Body() body: unknown) {
    const validated = RegisterUnitSchema.parse(body);
    return this.commandBus.execute(
      new RegisterRentalUnitCommand(validated.id, validated.ownerId, validated.address),
    );
  }

  @Post('invite')
  @HttpCode(HttpStatus.CREATED)
  public async inviteTenant(@Body() body: unknown) {
    const validated = InviteTenantSchema.parse(body);
    return this.commandBus.execute(
      new InviteTenantCommand(
        validated.id,
        validated.rentalUnitId,
        validated.tenantEmail,
        new Date(validated.expiresAt),
      ),
    );
  }

  @Post('accept-invitation')
  @HttpCode(HttpStatus.OK)
  public async acceptInvitation(@Body() body: unknown) {
    const validated = AcceptInvitationSchema.parse(body);
    return this.commandBus.execute(
      new AcceptInvitationCommand(
        validated.invitationId,
        validated.tenantId,
        validated.tenancyId,
        new Date(validated.startDate),
        new Date(validated.endDate),
      ),
    );
  }

  @Post('confirm-handover')
  @HttpCode(HttpStatus.CREATED)
  public async confirmHandover(@Body() body: unknown) {
    const validated = ConfirmHandoverSchema.parse(body);
    return this.commandBus.execute(
      new ConfirmHandoverCommand(
        validated.id,
        validated.tenancyId,
        validated.meterReadings,
        validated.checklist,
      ),
    );
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  public async activateTenancy(@Param('id') id: string, @Body() body: unknown) {
    const validated = ActivateTenancySchema.parse(body);
    return this.commandBus.execute(new ActivateTenancyCommand(id, validated.handoverProtocolId));
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  public async getTenancy(@Param('id') id: string) {
    return this.queryBus.execute(new GetTenancyQuery(id));
  }

  @Get('landlord/:id/units')
  @HttpCode(HttpStatus.OK)
  public async listLandlordUnits(@Param('id') landlordId: string) {
    return this.queryBus.execute(new ListLandlordRentalUnitsQuery(landlordId));
  }
}
