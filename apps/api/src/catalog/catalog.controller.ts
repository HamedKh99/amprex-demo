import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators.js';
import { CompatibleBatteriesQuery } from './catalog.dto.js';
import { CatalogService } from './catalog.service.js';

@ApiTags('catalog')
@Public()
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('vehicles')
  vehicles() {
    return this.catalog.vehicles();
  }

  @Get('vehicles/:id/batteries')
  compatible(@Param('id', ParseUUIDPipe) id: string, @Query() q: CompatibleBatteriesQuery) {
    return this.catalog.compatibleBatteries(id, q.district, q.coreReturn);
  }

  @Get('batteries')
  batteries() {
    return this.catalog.batteries();
  }
}
