import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/composition/auth.module';
import { TenancyModule } from './tenancy/composition/tenancy.module';
import { MaintenanceModule } from './maintenance/composition/maintenance.module';
import { authDataSourceOptions } from './auth/infrastructure/persistence/auth-data-source';
import { tenancyDataSourceOptions } from './tenancy/infrastructure/persistence/tenancy-data-source';
import { SharedModule } from './shared/composition/shared.module';
import { MetricsController } from './shared/interfaces/http/metrics.controller';
import { HealthController } from './shared/interfaces/http/health.controller';

@Module({
  imports: [
    TypeOrmModule.forRoot({ ...authDataSourceOptions, name: 'auth' }),
    TypeOrmModule.forRoot({ ...tenancyDataSourceOptions, name: 'tenancy' }),
    SharedModule,
    AuthModule,
    TenancyModule,
    MaintenanceModule,
  ],
  controllers: [MetricsController, HealthController],
})
export class AppModule {}
