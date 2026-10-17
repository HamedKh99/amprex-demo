import { Module } from '@nestjs/common';
import { BranchesModule } from '../branches/branches.module.js';
import { LookupsController } from './lookups.controller.js';
import { SchedulingService } from './scheduling.service.js';

@Module({
  imports: [BranchesModule],
  controllers: [LookupsController],
  providers: [SchedulingService],
  exports: [SchedulingService],
})
export class LookupsModule {}
