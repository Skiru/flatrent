import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/composition/auth.module';
import { TenancyModule } from './tenancy/composition/tenancy.module';
import { MaintenanceModule } from './maintenance/composition/maintenance.module';
import { authDataSourceOptions } from './auth/infrastructure/persistence/auth-data-source';

@Module({
  imports: [
    TypeOrmModule.forRoot({ ...authDataSourceOptions, name: 'auth' }),
    AuthModule,
    TenancyModule,
    MaintenanceModule,
  ],
})
export class AppModule {}
