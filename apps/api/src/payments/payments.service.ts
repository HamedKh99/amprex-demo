import { Injectable } from '@nestjs/common';
import type { PaymentMethod } from '@amprex/shared';
import type { AuthUser } from '../auth/auth.types.js';
import { OrderStateService } from '../orders/order-state.service.js';
import { OrdersService } from '../orders/orders.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly state: OrderStateService,
    private readonly orders: OrdersService,
  ) {}

  /**
   * Single full payment (assumption: no partial payments in the demo). The transition runs
   * first so a payment is never stored for an order that is not INSTALLED.
   */
  async record(user: AuthUser, orderId: string, method: PaymentMethod, reference?: string) {
    await this.prisma.$transaction(async (tx) => {
      const order = await this.state.transition(tx, {
        orderId,
        to: 'PAID',
        actor: user,
        data: { method },
      });
      const now = new Date();
      await tx.payment.create({
        data: {
          orderId,
          amountRial: order.totalRial,
          method,
          status: 'PAID',
          reference,
          receivedById: user.id,
          paidAt: now,
        },
      });
    });
    return this.orders.get(user, orderId);
  }
}
