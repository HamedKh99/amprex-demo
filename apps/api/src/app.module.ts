import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module.js';
import { BranchesModule } from './branches/branches.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { RateLimitGuard } from './common/rate-limit.js';
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
  // 120 requests/min per client IP and route unless a route sets @RateLimit (common/rate-limit.ts).
  providers: [{ provide: APP_GUARD, useClass: RateLimitGuard }],
})
export class AppModule {}
