import { Module } from '@nestjs/common';
import { MissionsController } from './missions.controller.js';

@Module({
  controllers: [MissionsController],
})
export class MissionsModule {}
