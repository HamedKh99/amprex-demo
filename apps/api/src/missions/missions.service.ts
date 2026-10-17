import { HttpStatus, Injectable } from '@nestjs/common';
import { type OrderStatus, type PaymentMethod, TERMINAL_ORDER_STATUSES, nextStatuses } from '@amprex/shared';
import type { AuthUser } from '../auth/auth.types.js';
import { orderScope } from '../auth/scope.js';
import { AppException, notFound } from '../common/app-exception.js';
import { dateOnly, formatDateOnly, tehranDate } from '../common/tehran-time.js';
import type { Prisma } from '../generated/prisma/client.js';
import { StockService } from '../inventory/stock.service.js';
import { OrderStateService } from '../orders/order-state.service.js';
import { OrdersService } from '../orders/orders.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { breakdown, coreScrapValue } from '../pricing/pricing.js';
import type { FinishDto, MissionView } from './missions.dto.js';

const FINISHED = [...TERMINAL_ORDER_STATUSES];

/** Field step → status it moves to and the mission timestamp it stamps. */
const STEPS = {
  accept: { to: 'ACCEPTED', stamp: 'acceptedAt' },
  depart: { to: 'EN_ROUTE', stamp: 'departedAt' },
  arrive: { to: 'ON_SITE', stamp: 'arrivedAt' },
  start: { to: 'INSTALLING', stamp: 'startedAt' },
} as const satisfies Record<string, { to: OrderStatus; stamp: keyof Prisma.MissionUpdateInput }>;
export type MissionStep = keyof typeof STEPS;

@Injectable()
export class MissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly state: OrderStateService,
    private readonly stock: StockService,
    private readonly orders: OrdersService,
  ) {}

  /** A technician sees only their own missions; office roles see their branch's. */
  async list(user: AuthUser, view: MissionView) {
    const today = dateOnly(tehranDate());
    const byView: Record<MissionView, Prisma.OrderWhereInput> = {
      active: { status: { notIn: FINISHED } },
      today: { scheduledDate: today, status: { not: 'CANCELLED' } },
      upcoming: { scheduledDate: { gt: today }, status: { notIn: FINISHED } },
      history: { status: { in: FINISHED } },
    };
    const orders = await this.prisma.order.findMany({
      where: { AND: [orderScope(user), { mission: { isNot: null } }, byView[view]] },
      select: {
        id: true,
        code: true,
        status: true,
        scheduledDate: true,
        district: true,
        address: true,
        installLocation: true,
        customerNote: true,
        branchNote: true,
        totalRial: true,
        customer: { select: { fullName: true, phone: true } },
        vehicleModel: { select: { nameFa: true } },
        battery: { select: { sku: true, nameFa: true, capacityAh: true } },
        slot: { select: { label: true, startTime: true, endTime: true, sortOrder: true } },
        mission: { include: { technician: { select: { id: true, fullName: true } } } },
      },
      orderBy: [{ scheduledDate: view === 'history' ? 'desc' : 'asc' }, { slot: { sortOrder: 'asc' } }],
      take: 100,
    });
    return orders.map((o) => ({
      ...o,
      scheduledDate: formatDateOnly(o.scheduledDate),
      allowedTransitions: nextStatuses(o.status, user.role),
    }));
  }

  /** «پذیرش مأموریت» / «حرکت به سمت مشتری» / «رسیدم» / «شروع کار» */
  async step(user: AuthUser, orderId: string, step: MissionStep) {
    const { to, stamp } = STEPS[step];
    await this.prisma.$transaction(async (tx) => {
      await this.state.transition(tx, { orderId, to, actor: user });
      await tx.mission.update({ where: { orderId }, data: { [stamp]: new Date() } });
    });
    return this.orders.get(user, orderId);
  }

  /**
   * Live figures for the finish form: payable for the old battery the technician sees,
   * and the difference from the estimate given at order time.
   */
  async settlementQuote(user: AuthUser, orderId: string, coreReturned: boolean, oldBatteryAh?: number) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, ...orderScope(user) } });
    if (!order) throw notFound('سفارش');
    return this.settlement(order, coreReturned ? (oldBatteryAh ?? null) : null);
  }

  /**
   * «ثبت پایان و تسویه»: one transaction issues the reserved battery, records the old battery
   * and the payment (received may differ from payable → mismatch), and completes the order.
   */
  async finish(user: AuthUser, orderId: string, dto: FinishDto) {
    const coreAh = dto.coreReturned ? (dto.oldBatteryAh ?? null) : null;
    if (dto.coreReturned && coreAh === null) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', 'آمپر باتری کهنه را وارد کنید.');
    }
    await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({ where: { id: orderId, ...orderScope(user) } });
      if (!order) throw notFound('سفارش');
      const price = this.settlement(order, coreAh);
      const received = BigInt(dto.receivedRial);
      const now = new Date();

      await this.state.transition(tx, {
        orderId,
        to: 'COMPLETED',
        actor: user,
        note: dto.technicianNote,
        data: {
          installedSerial: dto.installedSerial,
          coreAh,
          method: dto.method,
          receivedRial: dto.receivedRial,
          payableRial: price.totalRial.toString(),
        },
        patch: { coreCreditRial: price.coreCreditRial, totalRial: price.totalRial, completedAt: now },
      });
      await tx.mission.update({
        where: { orderId },
        data: { installedAt: now, installedSerial: dto.installedSerial, technicianNote: dto.technicianNote },
      });
      await tx.coreReturn.create({
        data: {
          orderId,
          returned: coreAh !== null,
          ampereHours: coreAh,
          creditAppliedRial: price.coreCreditRial,
          scrapValueRial: coreScrapValue(coreAh),
          recordedAt: now,
        },
      });
      await tx.payment.create({
        data: {
          orderId,
          amountRial: received,
          expectedRial: price.totalRial,
          method: dto.method as PaymentMethod,
          status: 'PAID',
          reference: dto.reference,
          receivedById: user.id,
          paidAt: now,
        },
      });
      await this.stock.issue(tx, {
        branchId: order.branchId,
        batteryId: order.batteryId,
        orderId,
        actorUserId: user.id,
      });
    });
    return this.orders.get(user, orderId);
  }

  private settlement(
    order: { batteryPriceRial: bigint; installFeeRial: bigint; totalRial: bigint; estimatedCoreAh: number | null; status: OrderStatus },
    coreAh: number | null,
  ) {
    const price = breakdown(order.batteryPriceRial, order.installFeeRial, coreAh);
    // The order total is the estimate until completion.
    const estimate = breakdown(order.batteryPriceRial, order.installFeeRial, order.estimatedCoreAh).totalRial;
    return { ...price, coreAh, estimateTotalRial: estimate, differenceRial: price.totalRial - estimate };
  }
}
