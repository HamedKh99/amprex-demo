import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module.js';
import { OrdersModule } from '../orders/orders.module.js';
import { MissionsController } from './missions.controller.js';
import { MissionsService } from './missions.service.js';

@Module({
  imports: [OrdersModule, InventoryModule],
  controllers: [MissionsController],
  providers: [MissionsService],
})
export class MissionsModule {}
