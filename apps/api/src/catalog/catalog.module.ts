import { Module } from '@nestjs/common';
import { BranchesModule } from '../branches/branches.module.js';
import { CatalogController } from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';

@Module({
  imports: [BranchesModule],
  controllers: [CatalogController],
  providers: [CatalogService],
})
export class CatalogModule {}
