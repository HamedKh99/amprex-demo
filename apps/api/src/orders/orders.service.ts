import { HttpStatus, Injectable } from '@nestjs/common';
import { type OrderStatus, nextStatuses } from '@amprex/shared';
import type { AuthUser } from '../auth/auth.types.js';
import { orderScope, scopedBranchId } from '../auth/scope.js';
import { BranchesService } from '../branches/branches.service.js';
import { AppException, forbidden, notFound } from '../common/app-exception.js';
import type { Page } from '../common/pagination.js';
import { dateOnly } from '../common/tehran-time.js';
import { Prisma } from '../generated/prisma/client.js';
import { StockService } from '../inventory/stock.service.js';
import { SchedulingService } from '../lookups/scheduling.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { quote } from '../pricing/pricing.js';
import { orderDetailInclude, orderListInclude } from './order.include.js';
import { OrderStateService } from './order-state.service.js';
import type { CreateOrderDto, ListOrdersQuery } from './orders.dto.js';

const OFFICE_ROLES = ['SUPER_ADMIN', 'BRANCH_MANAGER', 'OPERATOR'] as const;
const isOffice = (u?: AuthUser): u is AuthUser =>
  !!u && (OFFICE_ROLES as readonly string[]).includes(u.role);

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
    const price = quote(fit.battery, dto.coreReturnExpected);

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
            latitude: dto.latitude,
            longitude: dto.longitude,
            customerNote: dto.customerNote,
            coreReturnExpected: dto.coreReturnExpected,
            ...price,
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
        q.from || q.to
          ? { scheduledDate: { gte: q.from ? dateOnly(q.from) : undefined, lte: q.to ? dateOnly(q.to) : undefined } }
          : {},
        search
          ? {
              OR: [
                ...(/^\d{1,9}$/.test(search) ? [{ number: Number(search) }] : []),
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
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  async get(user: AuthUser, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, ...orderScope(user) },
      include: orderDetailInclude,
    });
    if (!order) throw notFound('سفارش');
    return this.withActions(order, user);
  }

  /** Public status page: the customer proves ownership with order number + phone. */
  async track(number: number, phone: string) {
    const order = await this.prisma.order.findFirst({
      where: { number, customer: { phone } },
      select: {
        number: true,
        status: true,
        scheduledDate: true,
        address: true,
        coreReturnExpected: true,
        batteryPriceRial: true,
        installFeeRial: true,
        coreCreditRial: true,
        totalRial: true,
        createdAt: true,
        vehicleModel: { select: { nameFa: true } },
        battery: { select: { nameFa: true, warrantyMonths: true } },
        slot: { select: { label: true, startTime: true, endTime: true } },
        branch: { select: { name: true, phone: true } },
        mission: { select: { technician: { select: { fullName: true } } } },
        events: { select: { toStatus: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!order) throw notFound('سفارشی با این مشخصات');
    return order;
  }

  async assign(user: AuthUser, orderId: string, technicianId: string, note?: string) {
    await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, ...orderScope(user) },
        include: { mission: true },
      });
      if (!order) throw notFound('سفارش');
      const technician = await tx.technician.findFirst({
        where: { id: technicianId, isActive: true, branchId: order.branchId },
      });
      if (!technician) {
        throw new AppException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'INVALID_TECHNICIAN',
          'تکنسین انتخاب‌شده فعال نیست یا متعلق به شعبه این سفارش نیست.',
          { technicianId },
        );
      }

      await this.state.transition(tx, {
        orderId,
        to: 'ASSIGNED',
        actor: user,
        note,
        data: { technicianId, previousTechnicianId: order.mission?.technicianId ?? null },
      });
      await tx.mission.upsert({
        where: { orderId },
        create: { orderId, technicianId },
        update: { technicianId, assignedAt: new Date() },
      });
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
      // Cancellation is only allowed before INSTALLED, so the unit is still reserved.
      await this.stock.release(tx, {
        branchId: order.branchId,
        batteryId: order.batteryId,
        orderId,
        actorUserId: user.id,
      });
    });
    return this.get(user, orderId);
  }

  async complete(user: AuthUser, orderId: string, note?: string) {
    await this.prisma.$transaction((tx) =>
      this.state.transition(tx, {
        orderId,
        to: 'COMPLETED',
        actor: user,
        note,
        patch: { completedAt: new Date() },
      }),
    );
    return this.get(user, orderId);
  }

  private async findByIdempotencyKey(key: string, user?: AuthUser) {
    const order = await this.prisma.order.findUnique({ where: { idempotencyKey: key }, select: { id: true } });
    return order ? this.detailById(order.id, user) : null;
  }

  /** Unscoped read for the creator of an order (they hold its Idempotency-Key). */
  private async detailById(id: string, user?: AuthUser) {
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id }, include: orderDetailInclude });
    return this.withActions(order, user);
  }

  /** The UI shows only the actions the API says are allowed. */
  private withActions<T extends { status: OrderStatus }>(order: T, user?: AuthUser) {
    return { ...order, allowedTransitions: user ? nextStatuses(order.status, user.role) : [] };
  }
}
