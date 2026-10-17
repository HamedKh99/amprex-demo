import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module.js';
import { BranchesModule } from './branches/branches.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { HealthController } from './health/health.controller.js';
import { InventoryModule } from './inventory/inventory.module.js';
import { LookupsModule } from './lookups/lookups.module.js';
import { MissionsModule } from './missions/missions.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    // One .env at the repo root serves the whole workspace; apps/api/.env may override.
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AuthModule,
    UsersModule,
    BranchesModule,
    CatalogModule,
    InventoryModule,
    LookupsModule,
    OrdersModule,
    MissionsModule,
    ReportsModule,
    DashboardModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
