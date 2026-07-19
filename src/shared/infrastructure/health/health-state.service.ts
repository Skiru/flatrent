import { Injectable, BeforeApplicationShutdown } from '@nestjs/common';

@Injectable()
export class HealthStateService implements BeforeApplicationShutdown {
  private isShuttingDown = false;

  public beforeApplicationShutdown(_signal?: string) {
    this.isShuttingDown = true;
  }

  public getStatus(): { status: string; httpStatus: number } {
    if (this.isShuttingDown) {
      return { status: 'shutting_down', httpStatus: 503 };
    }
    return { status: 'UP', httpStatus: 200 };
  }
}
