import { HttpStatus, Injectable } from '@nestjs/common';
import {
  type OrderStatus,
  type Role,
  type TrackingMilestone,
  nextStatuses,
} from '@amprex/shared';
import type { AuthUser } from '../auth/auth.types.js';
import { orderScope, scopedBranchId } from '../auth/scope.js';
import { BranchesService } from '../branches/branches.service.js';
import { AppException, forbidden, notFound } from '../common/app-exception.js';
import type { Page } from '../common/pagination.js';
import { dateOnly, formatDateOnly } from '../common/tehran-time.js';
import { Prisma } from '../generated/prisma/client.js';
import { StockService } from '../inventory/stock.service.js';
import { SchedulingService } from '../lookups/scheduling.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { coreScrapValue, grossProfit, quote } from '../pricing/pricing.js';
import { orderDetailInclude, orderListInclude } from './order.include.js';
import { orderCode } from './order-code.js';
import { OrderStateService } from './order-state.service.js';
import type { CreateOrderDto, ListOrdersQuery } from './orders.dto.js';
import { rankForOrder, technicianLoads } from './technician-load.js';

const OFFICE_ROLES: readonly Role[] = ['SUPER_ADMIN', 'BRANCH_MANAGER', 'OPERATOR'];
const isOffice = (u?: AuthUser): u is AuthUser => !!u && OFFICE_ROLES.includes(u.role);
/** Cost price and gross profit are for managers only. */
const seesFinancials = (u?: AuthUser) => u?.role === 'SUPER_ADMIN' || u?.role === 'BRANCH_MANAGER';

type OrderDetail = Prisma.OrderGetPayload<{ include: typeof orderDetailInclude }>;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly state: OrderStateService,
    private readonly stock: StockService,
    private readonly branches: BranchesService,
    private readonly scheduling: SchedulingService,
  ) {}

  /**
   * Creates an order and reserves its battery in one transaction.
   * A repeated Idempotency-Key returns the order created by the first request.
   */
  async create(dto: CreateOrderDto, idempotencyKey: string, user?: AuthUser) {
    const existing = await this.findByIdempotencyKey(idempotencyKey, user);
    if (existing) return { order: existing, created: false };

    // Anonymous (and technician) requests are website orders; office staff may set the channel.
    const staff = isOffice(user) ? user : null;
    const branch = await this.branches.forDistrict(dto.district);
    if (staff && staff.role !== 'SUPER_ADMIN' && staff.branchId !== branch.id) {
      throw forbidden('این منطقه تحت پوشش شعبه شما نیست.');
    }
    this.scheduling.assertBookableDate(dto.scheduledDate);

    const channelCode = staff && dto.channelCode ? dto.channelCode : 'WEBSITE';
    const channel = await this.prisma.channel.findFirst({ where: { code: channelCode, isActive: true } });
    if (!channel) throw notFound('کانال فروش');

    const fit = await this.prisma.batteryCompatibility.findUnique({
      where: { vehicleModelId_batteryId: { vehicleModelId: dto.vehicleModelId, batteryId: dto.batteryId } },
      include: { battery: true, vehicleModel: true },
    });
    if (!fit?.battery.isActive || !fit.vehicleModel.isActive) {
      throw new AppException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'INCOMPATIBLE_BATTERY',
        'باتری انتخاب‌شده با این خودرو سازگار نیست.',
        { vehicleModelId: dto.vehicleModelId, batteryId: dto.batteryId },
      );
    }
    const { estimatedCoreAh, ...price } = quote(fit.battery, dto.hasOldBattery);

    try {
      const orderId = await this.prisma.$transaction(async (tx) => {
        await this.scheduling.claimSlot(tx, branch.id, dto.scheduledDate, dto.slotId);
        const customer = await tx.customer.upsert({
          where: { phone: dto.customerPhone },
          create: { phone: dto.customerPhone, fullName: dto.customerName },
          update: { fullName: dto.customerName },
        });
        const order = await tx.order.create({
          data: {
            code: await this.uniqueCode(tx),
            idempotencyKey,
            customerId: customer.id,
            branchId: branch.id,
            channelId: channel.id,
            vehicleModelId: dto.vehicleModelId,
            batteryId: dto.batteryId,
            slotId: dto.slotId,
            scheduledDate: dateOnly(dto.scheduledDate),
            district: dto.district,
            address: dto.address,
            installLocation: dto.installLocation,
            latitude: dto.latitude,
            longitude: dto.longitude,
            customerNote: dto.customerNote,
            estimatedCoreAh,
            ...price,
            batteryCostRial: fit.battery.costRial,
            createdById: staff?.id ?? null,
          },
        });
        await this.stock.reserve(tx, {
          branchId: branch.id,
          batteryId: dto.batteryId,
          orderId: order.id,
          actorUserId: staff?.id ?? null,
        });
        await this.state.recordCreated(tx, order.id, staff, { channel: channel.code });
        return order.id;
      });
      return { order: await this.detailById(orderId, user), created: true };
    } catch (e) {
      // Same key raced in from a parallel request: hand back the winner's order.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const winner = await this.findByIdempotencyKey(idempotencyKey, user);
        if (winner) return { order: winner, created: false };
      }
      throw e;
    }
  }

  async list(user: AuthUser, q: ListOrdersQuery): Promise<Page<unknown>> {
    const search = q.q?.trim();
    const where: Prisma.OrderWhereInput = {
      AND: [
        orderScope(user),
        user.role === 'TECHNICIAN' ? {} : { branchId: scopedBranchId(user, q.branchId) },
        q.status?.length ? { status: { in: q.status } } : {},
        q.channelCode ? { channel: { code: q.channelCode } } : {},
        q.from || q.to
          ? { scheduledDate: { gte: q.from ? dateOnly(q.from) : undefined, lte: q.to ? dateOnly(q.to) : undefined } }
          : {},
        search
          ? {
              OR: [
                { code: { contains: search.toUpperCase() } },
                { customer: { phone: { contains: search } } },
                { customer: { fullName: { contains: search, mode: 'insensitive' } } },
              ],
            }
          : {},
      ],
    };
    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: orderListInclude,
        omit: { batteryCostRial: true },
        orderBy: [{ scheduledDate: 'desc' }, { createdAt: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  /** Badge counts for the admin navigation. */
  async counts(user: AuthUser) {
    const waitingAssignment = await this.prisma.order.count({
      where: { ...orderScope(user), status: 'CREATED' },
    });
    return { waitingAssignment };
  }

  async get(user: AuthUser, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, ...orderScope(user) },
      include: orderDetailInclude,
    });
    if (!order) throw notFound('سفارش');
    return this.present(order, user);
  }

  /** Public status page: the customer proves ownership with tracking code + phone. */
  async track(code: string, phone: string) {
    const order = await this.prisma.order.findFirst({
      where: { code, customer: { phone } },
      include: {
        vehicleModel: { select: { nameFa: true } },
        battery: { select: { brand: true, nameFa: true, capacityAh: true, warrantyMonths: true } },
        slot: { select: { label: true, startTime: true, endTime: true } },
        branch: { select: { name: true, phone: true } },
        mission: { include: { technician: { select: { fullName: true, phone: true } } } },
      },
    });
    if (!order) throw notFound('سفارشی با این مشخصات');
    const m = order.mission;
    // Only expose the technician once the job is under way.
    const showTech = !!m && ['ACCEPTED', 'EN_ROUTE', 'ON_SITE', 'INSTALLING'].includes(order.status);
    return {
      code: order.code,
      status: order.status,
      scheduledDate: formatDateOnly(order.scheduledDate),
      slot: order.slot,
      vehicleModel: order.vehicleModel,
      battery: order.battery,
      branch: order.branch,
      totalRial: order.totalRial,
      technician: showTech ? m!.technician : null,
      milestones: milestones(order),
    };
  }

  /** Technicians of the order's branch for the assignment sheet, best fit first. */
  async technicianOptions(user: AuthUser, orderId: string) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, ...orderScope(user) } });
    if (!order) throw notFound('سفارش');
    const loads = await technicianLoads(this.prisma, order.branchId, order.scheduledDate);
    return rankForOrder(loads, order);
  }

  async assign(user: AuthUser, orderId: string, technicianId: string, note?: string) {
    await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, ...orderScope(user) },
        include: { mission: true },
      });
      if (!order) throw notFound('سفارش');

      const loads = await technicianLoads(this.prisma, order.branchId, order.scheduledDate);
      const option = rankForOrder(loads, order).find((t) => t.id === technicianId);
      if (!option || option.fit === 'FULL') {
        throw new AppException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'INVALID_TECHNICIAN',
          option ? 'ظرفیت امروز این تکنسین تکمیل است.' : 'تکنسین انتخاب‌شده فعال نیست یا متعلق به شعبه این سفارش نیست.',
          { technicianId },
        );
      }

      await this.state.transition(tx, {
        orderId,
        to: 'ASSIGNED',
        actor: user,
        data: { technicianId, previousTechnicianId: order.mission?.technicianId ?? null },
      });
      await tx.mission.upsert({
        where: { orderId },
        create: { orderId, technicianId },
        update: { technicianId, assignedAt: new Date(), acceptedAt: null },
      });
      if (note !== undefined && note !== (order.branchNote ?? '')) {
        await tx.order.update({ where: { id: orderId }, data: { branchNote: note || null } });
        await tx.orderEvent.create({
          data: { orderId, kind: 'NOTE', actorUserId: user.id, data: { from: order.branchNote, to: note || null } },
        });
      }
    });
    return this.get(user, orderId);
  }

  async cancel(user: AuthUser, orderId: string, reason: string) {
    await this.prisma.$transaction(async (tx) => {
      const order = await this.state.transition(tx, {
        orderId,
        to: 'CANCELLED',
        actor: user,
        note: reason,
        patch: { cancelReason: reason, cancelledAt: new Date() },
      });
      // Cancellation is only allowed before completion, so the unit is still reserved.
      await this.stock.release(tx, {
        branchId: order.branchId,
        batteryId: order.batteryId,
        orderId,
        actorUserId: user.id,
      });
    });
    return this.get(user, orderId);
  }

  /** Unscoped read for the creator of an order (they hold its Idempotency-Key). */
  private async findByIdempotencyKey(key: string, user?: AuthUser) {
    const order = await this.prisma.order.findUnique({ where: { idempotencyKey: key }, select: { id: true } });
    return order ? this.detailById(order.id, user) : null;
  }

  private async detailById(id: string, user?: AuthUser) {
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id }, include: orderDetailInclude });
    return this.present(order, user);
  }

  private async uniqueCode(tx: Prisma.TransactionClient): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = orderCode(new Date());
      if (!(await tx.order.findUnique({ where: { code }, select: { id: true } }))) return code;
    }
    throw new Error('Could not generate a unique order code');
  }

  /** Adds what the screens need and strips manager-only figures for other roles. */
  private async present(order: OrderDetail, user?: AuthUser) {
    const [slotBooked, previousOrders] = await Promise.all([
      this.prisma.order.count({
        where: {
          branchId: order.branchId,
          slotId: order.slotId,
          scheduledDate: order.scheduledDate,
          status: { not: 'CANCELLED' },
        },
      }),
      this.prisma.order.findMany({
        where: { customerId: order.customerId, id: { not: order.id } },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    const { batteryCostRial, ...rest } = order;
    const coreAh = order.coreReturn ? order.coreReturn.ampereHours : order.estimatedCoreAh;
    return {
      ...rest,
      scheduledDate: formatDateOnly(order.scheduledDate),
      slotLoad: { booked: slotBooked, capacity: order.slot.capacity },
      customerHistory: { previousOrders: previousOrders.length, firstOrderAt: previousOrders[0]?.createdAt ?? null },
      financials: seesFinancials(user)
        ? {
            batteryCostRial,
            coreScrapValueRial: coreScrapValue(coreAh),
            grossProfitRial: grossProfit(order.totalRial, batteryCostRial, coreAh),
            isEstimate: order.status !== 'COMPLETED',
          }
        : null,
      allowedTransitions: user ? nextStatuses(order.status, user.role) : [],
    };
  }
}

/** Customer-facing progress (design: «مراحل سفارش» on the tracking page). */
function milestones(order: {
  status: OrderStatus;
  createdAt: Date;
  completedAt: Date | null;
  mission: { assignedAt: Date; departedAt: Date | null; arrivedAt: Date | null; startedAt: Date | null } | null;
}) {
  const s = order.status;
  const m = order.mission;
  const done = (k: TrackingMilestone): boolean => {
    switch (k) {
      case 'PLACED':
      case 'RESERVED':
        return true;
      case 'ASSIGNED':
        return !!m && s !== 'CREATED' && s !== 'CANCELLED';
      case 'EN_ROUTE':
        return ['ON_SITE', 'INSTALLING', 'COMPLETED'].includes(s);
      case 'INSTALLING':
      case 'SETTLED':
        return s === 'COMPLETED';
    }
  };
  const now: Partial<Record<OrderStatus, TrackingMilestone>> = {
    CREATED: 'ASSIGNED',
    EN_ROUTE: 'EN_ROUTE',
    ON_SITE: 'INSTALLING',
    INSTALLING: 'INSTALLING',
  };
  const at: Record<TrackingMilestone, Date | null | undefined> = {
    PLACED: order.createdAt,
    RESERVED: order.createdAt,
    ASSIGNED: m?.assignedAt,
    EN_ROUTE: m?.departedAt,
    INSTALLING: m?.startedAt ?? m?.arrivedAt,
    SETTLED: order.completedAt,
  };
  return (['PLACED', 'RESERVED', 'ASSIGNED', 'EN_ROUTE', 'INSTALLING', 'SETTLED'] as const).map((key) => ({
    key,
    state: done(key) ? 'DONE' : now[s] === key ? 'NOW' : 'TODO',
    at: done(key) || now[s] === key ? (at[key] ?? null) : null,
  }));
}
