import { Module } from '@nestjs/common';
import { MetricsRegistry } from '../infrastructure/metrics/metrics-registry';
import { HealthStateService } from '../infrastructure/health/health-state.service';

@Module({
  providers: [MetricsRegistry, HealthStateService],
  exports: [MetricsRegistry, HealthStateService],
})
export class SharedModule {}
