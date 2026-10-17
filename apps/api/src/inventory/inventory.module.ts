import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller.js';
import { InventoryService } from './inventory.service.js';
import { StockService } from './stock.service.js';

@Module({
  controllers: [InventoryController],
  providers: [StockService, InventoryService],
  exports: [StockService],
})
export class InventoryModule {}
