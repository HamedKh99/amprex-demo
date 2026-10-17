import { Module } from '@nestjs/common';
import { LookupsController } from './lookups.controller.js';

@Module({
  controllers: [LookupsController],
})
export class LookupsModule {}
