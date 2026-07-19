import { Global, Module } from '@nestjs/common';
import { MetricsRegistry } from '../infrastructure/metrics/metrics-registry';
import { HealthStateService } from '../infrastructure/health/health-state.service';

@Global()
@Module({
  providers: [MetricsRegistry, HealthStateService],
  exports: [MetricsRegistry, HealthStateService],
})
export class SharedModule {}
