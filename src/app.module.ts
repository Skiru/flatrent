import { Module } from '@nestjs/common';
import { AuthModule } from './auth/composition/auth.module';
import { TenancyModule } from './tenancy/composition/tenancy.module';
import { MaintenanceModule } from './maintenance/composition/maintenance.module';

@Module({
  imports: [AuthModule, TenancyModule, MaintenanceModule],
})
export class AppModule {}
