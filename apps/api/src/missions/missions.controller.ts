import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiParam, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { notFound } from '../common/app-exception.js';
import { FinishDto, MissionsQuery, SettlementQuery } from './missions.dto.js';
import { type MissionStep, MissionsService } from './missions.service.js';

const STEPS: readonly MissionStep[] = ['accept', 'depart', 'arrive', 'start'];

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

  /** Payable for the old battery on site, vs the estimate (finish form). */
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'TECHNICIAN')
  @Get(':orderId/settlement')
  settlement(
    @CurrentUser() user: AuthUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Query() q: SettlementQuery,
  ) {
    return this.missions.settlementQuote(user, orderId, q.coreReturned, q.oldBatteryAh);
  }

  /** «ثبت پایان و تسویه» */
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'TECHNICIAN')
  @Post(':orderId/finish')
  @HttpCode(200)
  finish(@CurrentUser() user: AuthUser, @Param('orderId', ParseUUIDPipe) orderId: string, @Body() dto: FinishDto) {
    return this.missions.finish(user, orderId, dto);
  }

  /** accept → ACCEPTED, depart → EN_ROUTE, arrive → ON_SITE, start → INSTALLING */
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'TECHNICIAN')
  @ApiParam({ name: 'step', enum: STEPS })
  @Post(':orderId/:step')
  @HttpCode(200)
  step(
    @CurrentUser() user: AuthUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Param('step') step: string,
  ) {
    if (!STEPS.includes(step as MissionStep)) throw notFound('مرحله');
    return this.missions.step(user, orderId, step as MissionStep);
  }
}
