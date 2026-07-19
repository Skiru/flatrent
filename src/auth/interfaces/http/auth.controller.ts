import { Controller, Post, Get, Body, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { z } from 'zod';
import { RegisterUserCommand } from '../../application/commands/register-user/register-user.command';
import { LoginCommand } from '../../application/commands/login/login.command';
import { RefreshTokenCommand } from '../../application/commands/refresh-token/refresh-token.command';
import { LogoutCommand } from '../../application/commands/logout/logout.command';
import { ChangePasswordCommand } from '../../application/commands/change-password/change-password.command';
import { GetCurrentActorQuery } from '../../application/queries/get-current-actor/get-current-actor.query';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { UserRole } from '../../domain/model/user-account.aggregate';

const RegisterSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['LANDLORD', 'TENANT']),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const RefreshSchema = z.object({
  sessionId: z.string().uuid(),
  refreshToken: z.string(),
});

const ChangePasswordSchema = z.object({
  oldPassword: z.string(),
  newPassword: z.string().min(8),
});

@Controller('api/v1/auth')
export class AuthController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  public async register(@Body() body: unknown) {
    const validated = RegisterSchema.parse(body);
    const command = new RegisterUserCommand(
      validated.id,
      validated.email,
      validated.password,
      validated.role as UserRole,
    );
    return this.commandBus.execute(command);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  public async login(@Body() body: unknown) {
    const validated = LoginSchema.parse(body);
    const command = new LoginCommand(validated.email, validated.password);
    return this.commandBus.execute(command);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  public async refresh(@Body() body: unknown) {
    const validated = RefreshSchema.parse(body);
    const command = new RefreshTokenCommand(validated.sessionId, validated.refreshToken);
    return this.commandBus.execute(command);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  public async logout(@Body() body: unknown) {
    const LogoutSchema = z.object({ sessionId: z.string().uuid() });
    const validated = LogoutSchema.parse(body);
    await this.commandBus.execute(new LogoutCommand(validated.sessionId));
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  public async changePassword(@Req() req: { user: { sub: string } }, @Body() body: unknown) {
    const validated = ChangePasswordSchema.parse(body);
    const userId = req.user.sub;
    const command = new ChangePasswordCommand(userId, validated.oldPassword, validated.newPassword);
    await this.commandBus.execute(command);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  public async me(@Req() req: { user: { sub: string } }) {
    const userId = req.user.sub;
    return this.queryBus.execute(new GetCurrentActorQuery(userId));
  }
}
