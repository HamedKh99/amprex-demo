import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators.js';
import { CompatibleBatteriesQuery, VehiclesQuery } from './catalog.dto.js';
import { CatalogService } from './catalog.service.js';

@ApiTags('catalog')
@Public()
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('brands')
  brands() {
    return this.catalog.brands();
  }

  @Get('vehicles')
  vehicles(@Query() q: VehiclesQuery) {
    return this.catalog.vehicles(q);
  }

  @Get('vehicles/:id/batteries')
  compatible(@Param('id', ParseUUIDPipe) id: string, @Query() q: CompatibleBatteriesQuery) {
    return this.catalog.compatibleBatteries(id, q.district, q.availableOnly);
  }
}
