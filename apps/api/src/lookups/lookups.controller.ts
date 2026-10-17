import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import { Public } from '../auth/decorators.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SchedulingService } from './scheduling.service.js';

class AvailabilityQuery {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(22)
  district: number;
}

@ApiTags('lookups')
@Public()
@Controller('lookups')
export class LookupsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduling: SchedulingService,
  ) {}

  @Get('channels')
  channels() {
    return this.prisma.channel.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
  }

  @Get('slots')
  slots() {
    return this.prisma.serviceSlot.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
  }

  /** Bookable dates and slots with remaining capacity, for the branch serving the district. */
  @Get('availability')
  availability(@Query() q: AvailabilityQuery) {
    return this.scheduling.availability(q.district);
  }
}
