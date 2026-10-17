import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PAYMENT_METHODS, type PaymentMethod } from '@amprex/shared';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { NormalizeText } from '../common/transforms.js';
import { PaymentsService } from './payments.service.js';

class RecordPaymentDto {
  @IsIn(PAYMENT_METHODS)
  method: PaymentMethod;

  /** POS / bank / gateway reference number. */
  @IsOptional()
  @NormalizeText()
  @IsString()
  @MaxLength(60)
  reference?: string;
}

@ApiTags('payments')
@ApiBearerAuth()
@Controller('orders/:orderId/payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /** Record the customer's payment after installation; the amount is the order total. */
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'OPERATOR', 'TECHNICIAN')
  @Post()
  record(
    @CurrentUser() user: AuthUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: RecordPaymentDto,
  ) {
    return this.payments.record(user, orderId, dto.method, dto.reference);
  }
}
