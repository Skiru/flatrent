import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { HealthStateService } from '../../infrastructure/health/health-state.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthState: HealthStateService) {}

  @Get()
  public getHealth(@Res() res: Response) {
    const { status, httpStatus } = this.healthState.getStatus();
    return res.status(httpStatus).json({ status });
  }
}
