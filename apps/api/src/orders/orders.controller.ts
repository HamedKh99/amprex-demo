import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Public, Roles } from '../auth/decorators.js';
import { AppException } from '../common/app-exception.js';
import { BUSINESS_RULES } from '../config/business-rules.js';
import {
  AssignDto,
  CancelDto,
  CreateOrderDto,
  ListOrdersQuery,
  NoteDto,
  TrackOrderQuery,
} from './orders.dto.js';
import { OrdersService } from './orders.service.js';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  /**
   * Place an order (public). Requires an Idempotency-Key header; repeating a key returns
   * the existing order with 200 instead of 201.
   */
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Unique per checkout attempt (UUID).' })
  @Post()
  async create(
    @Body() dto: CreateOrderDto,
    @Headers('idempotency-key') key: string | undefined,
    @CurrentUser() user: AuthUser | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const trimmed = key?.trim();
    if (!trimmed || trimmed.length > BUSINESS_RULES.idempotencyKeyMaxLength) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'IDEMPOTENCY_KEY_REQUIRED',
        'سرآیند Idempotency-Key الزامی است (حداکثر ۱۰۰ نویسه).',
      );
    }
    const { order, created } = await this.orders.create(dto, trimmed, user);
    res.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return order;
  }

  @Public()
  @Get('track')
  track(@Query() q: TrackOrderQuery) {
    return this.orders.track(q.number, q.phone);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: ListOrdersQuery) {
    return this.orders.list(user, q);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.get(user, id);
  }

  /** Assign or reassign the technician. */
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'OPERATOR')
  @Post(':id/assign')
  @HttpCode(200)
  assign(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignDto) {
    return this.orders.assign(user, id, dto.technicianId, dto.note);
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'OPERATOR')
  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelDto) {
    return this.orders.cancel(user, id, dto.reason);
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'OPERATOR')
  @Post(':id/complete')
  @HttpCode(200)
  complete(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: NoteDto) {
    return this.orders.complete(user, id, dto.note);
  }
}
