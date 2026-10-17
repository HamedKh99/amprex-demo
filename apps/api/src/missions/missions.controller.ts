import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { InstallDto, MissionsQuery } from './missions.dto.js';
import { MissionsService } from './missions.service.js';

/** Technician workflow. Routes take the order id. */
@ApiTags('missions')
@ApiBearerAuth()
@Controller('missions')
export class MissionsController {
  constructor(private readonly missions: MissionsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: MissionsQuery) {
    return this.missions.list(user, q.view);
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'TECHNICIAN')
  @Post(':orderId/depart')
  @HttpCode(200)
  depart(@CurrentUser() user: AuthUser, @Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.missions.depart(user, orderId);
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'TECHNICIAN')
  @Post(':orderId/arrive')
  @HttpCode(200)
  arrive(@CurrentUser() user: AuthUser, @Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.missions.arrive(user, orderId);
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'TECHNICIAN')
  @Post(':orderId/install')
  @HttpCode(200)
  install(
    @CurrentUser() user: AuthUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: InstallDto,
  ) {
    return this.missions.install(user, orderId, dto);
  }
}
