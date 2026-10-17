import { HttpStatus, Injectable } from '@nestjs/common';
import { type OrderStatus, ORDER_TRANSITIONS, canTransition, nextStatuses } from '@amprex/shared';
import type { AuthUser } from '../auth/auth.types.js';
import { orderScope } from '../auth/scope.js';
import { AppException, forbidden, notFound } from '../common/app-exception.js';
import type { Order, Prisma } from '../generated/prisma/client.js';

type Tx = Prisma.TransactionClient;

export interface TransitionParams {
  orderId: string;
  to: OrderStatus;
  actor: AuthUser;
  note?: string;
  data?: Prisma.InputJsonValue;
  /** Extra order columns written in the same UPDATE (e.g. completedAt, totalRial). */
  patch?: Omit<Prisma.OrderUpdateManyMutationInput, 'status'>;
}

/**
 * The only place an order's status changes. Must run inside the caller's transaction so
 * side effects (stock, mission, payment) commit or roll back together with the change.
 */
@Injectable()
export class OrderStateService {
  async transition(tx: Tx, p: TransitionParams): Promise<Order> {
    const order = await tx.order.findFirst({ where: { id: p.orderId, ...orderScope(p.actor) } });
    if (!order) throw notFound('سفارش');

    if (!canTransition(order.status, p.to, p.actor.role)) {
      const exists = ORDER_TRANSITIONS.some((t) => t.from === order.status && t.to === p.to);
      if (exists) throw forbidden('نقش شما اجازه انجام این تغییر وضعیت را ندارد.');
      throw new AppException(
        HttpStatus.CONFLICT,
        'INVALID_TRANSITION',
        'این تغییر وضعیت برای سفارش در وضعیت فعلی مجاز نیست.',
        { from: order.status, to: p.to, allowed: nextStatuses(order.status, p.actor.role) },
      );
    }

    // Guard on the status we validated against: a concurrent change makes this a no-op.
    const { count } = await tx.order.updateMany({
      where: { id: order.id, status: order.status },
      data: { ...p.patch, status: p.to },
    });
    if (count === 0) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'INVALID_TRANSITION',
        'وضعیت سفارش هم‌زمان تغییر کرده است. صفحه را به‌روزرسانی کنید.',
        { from: order.status, to: p.to },
      );
    }

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        fromStatus: order.status,
        toStatus: p.to,
        actorUserId: p.actor.id,
        note: p.note,
        data: p.data,
      },
    });
    return tx.order.findUniqueOrThrow({ where: { id: order.id } });
  }

  /** The birth event of an order (no previous status). */
  recordCreated(tx: Tx, orderId: string, actor: AuthUser | null, data?: Prisma.InputJsonValue) {
    return tx.orderEvent.create({
      data: { orderId, fromStatus: null, toStatus: 'CREATED', actorUserId: actor?.id ?? null, data },
    });
  }
}
