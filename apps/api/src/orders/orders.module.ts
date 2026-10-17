import { Module } from '@nestjs/common';
import { BranchesModule } from '../branches/branches.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { LookupsModule } from '../lookups/lookups.module.js';
import { OrderStateService } from './order-state.service.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

@Module({
  imports: [BranchesModule, InventoryModule, LookupsModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrderStateService],
  exports: [OrdersService, OrderStateService],
})
export class OrdersModule {}
