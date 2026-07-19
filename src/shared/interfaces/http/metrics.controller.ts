import { Controller, Get, Header } from '@nestjs/common';
import { MetricsRegistry } from '../../infrastructure/metrics/metrics-registry';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsRegistry: MetricsRegistry) {}

  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  public getMetrics(): string {
    return this.metricsRegistry.getPrometheusMetrics();
  }
}
