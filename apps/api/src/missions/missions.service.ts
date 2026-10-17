import { Injectable } from '@nestjs/common';
import { nextStatuses, TERMINAL_ORDER_STATUSES } from '@amprex/shared';
import type { AuthUser } from '../auth/auth.types.js';
import { orderScope } from '../auth/scope.js';
import { notFound } from '../common/app-exception.js';
import { dateOnly, tehranDate } from '../common/tehran-time.js';
import type { Prisma } from '../generated/prisma/client.js';
import { StockService } from '../inventory/stock.service.js';
import { OrderStateService } from '../orders/order-state.service.js';
import { OrdersService } from '../orders/orders.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { breakdown, coreCreditFor } from '../pricing/pricing.js';
import type { InstallDto, MissionView } from './missions.dto.js';

const FINISHED = [...TERMINAL_ORDER_STATUSES];

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
      today: { scheduledDate: today },
      upcoming: { scheduledDate: { gt: today }, status: { notIn: FINISHED } },
      history: { status: { in: FINISHED } },
    };
    const orders = await this.prisma.order.findMany({
      where: { AND: [orderScope(user), { mission: { isNot: null } }, byView[view]] },
      select: {
        id: true,
        number: true,
        status: true,
        scheduledDate: true,
        district: true,
        address: true,
        latitude: true,
        longitude: true,
        customerNote: true,
        coreReturnExpected: true,
        totalRial: true,
        customer: { select: { fullName: true, phone: true } },
        vehicleModel: { select: { nameFa: true } },
        battery: { select: { sku: true, nameFa: true } },
        slot: { select: { label: true, startTime: true, endTime: true, sortOrder: true } },
        mission: { include: { technician: { select: { id: true, fullName: true } } } },
      },
      orderBy: [{ scheduledDate: view === 'history' ? 'desc' : 'asc' }, { slot: { sortOrder: 'asc' } }],
      take: 100,
    });
    return orders.map((o) => ({ ...o, allowedTransitions: nextStatuses(o.status, user.role) }));
  }

  async depart(user: AuthUser, orderId: string) {
    await this.prisma.$transaction(async (tx) => {
      await this.state.transition(tx, { orderId, to: 'EN_ROUTE', actor: user });
      await tx.mission.update({ where: { orderId }, data: { departedAt: new Date() } });
    });
    return this.orders.get(user, orderId);
  }

  async arrive(user: AuthUser, orderId: string) {
    await this.prisma.$transaction(async (tx) => {
      await this.state.transition(tx, { orderId, to: 'ON_SITE', actor: user });
      await tx.mission.update({ where: { orderId }, data: { arrivedAt: new Date() } });
    });
    return this.orders.get(user, orderId);
  }

  /**
   * New battery installed and old battery outcome recorded. In one transaction: the held unit
   * is issued from stock, the core credit is set from the actual condition, and the total is fixed.
   */
  async install(user: AuthUser, orderId: string, dto: InstallDto) {
    await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, ...orderScope(user) },
        include: { battery: true },
      });
      if (!order) throw notFound('سفارش');

      const credit = coreCreditFor(order.battery, dto.coreCondition);
      const price = breakdown(order.batteryPriceRial, order.installFeeRial, credit);
      const now = new Date();

      await this.state.transition(tx, {
        orderId,
        to: 'INSTALLED',
        actor: user,
        note: dto.technicianNote,
        data: { coreCondition: dto.coreCondition, installedSerial: dto.installedSerial },
        patch: { coreCreditRial: price.coreCreditRial, totalRial: price.totalRial },
      });
      await tx.mission.update({
        where: { orderId },
        data: { installedAt: now, installedSerial: dto.installedSerial, technicianNote: dto.technicianNote },
      });
      await tx.coreReturn.create({
        data: {
          orderId,
          condition: dto.coreCondition,
          oldBatteryNote: dto.oldBatteryNote,
          creditAppliedRial: credit,
          recordedAt: now,
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
}
