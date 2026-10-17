import { Injectable } from '@nestjs/common';
import { ACTIVE_MISSION_STATUSES, type OrderStatus } from '@amprex/shared';
import { addDays, dateOnly, tehranDate, tehranTime } from '../common/tehran-time.js';
import { BUSINESS_RULES } from '../config/business-rules.js';
import { Prisma } from '../generated/prisma/client.js';
import { technicianLoads } from '../orders/technician-load.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { grossProfit } from '../pricing/pricing.js';

/** What a technician is doing right now (design: «وضعیت فعلی»). */
const CURRENT_PRIORITY: OrderStatus[] = ['INSTALLING', 'ON_SITE', 'EN_ROUTE'];

/**
 * Admin dashboard for one Tehran day: jobs scheduled today, today's money,
 * things that need attention now, and technicians' workload.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async today(branchId?: string) {
    const now = new Date();
    const date = tehranDate(now);
    const day = dateOnly(date);
    const scope = { branchId };

    const orders = await this.prisma.order.findMany({
      where: { ...scope, scheduledDate: day },
      select: {
        id: true,
        code: true,
        status: true,
        district: true,
        totalRial: true,
        batteryCostRial: true,
        estimatedCoreAh: true,
        channel: { select: { code: true, nameFa: true, sortOrder: true } },
        slot: { select: { id: true, label: true, startTime: true, endTime: true } },
        coreReturn: { select: { ampereHours: true } },
        payments: { where: { status: 'PAID' }, select: { amountRial: true } },
        mission: { select: { technician: { select: { fullName: true, phone: true } } } },
      },
    });

    const byStatus = countBy(orders, (o) => o.status);
    const byChannel = new Map<string, { code: string; nameFa: string; count: number; sortOrder: number }>();
    for (const o of orders) {
      const c = byChannel.get(o.channel.code) ?? { ...o.channel, count: 0 };
      c.count++;
      byChannel.set(o.channel.code, c);
    }

    const completed = orders.filter((o) => o.status === 'COMPLETED');
    const salesRial = completed.reduce((s, o) => s + o.payments.reduce((p, x) => p + x.amountRial, 0n), 0n);
    const grossProfitRial = completed.reduce(
      (s, o) => s + grossProfit(o.totalRial, o.batteryCostRial, o.coreReturn?.ampereHours ?? null),
      0n,
    );

    // Earliest upcoming slot with orders still waiting for a technician.
    const waiting = orders.filter((o) => o.status === 'CREATED');
    const waitingBySlot = groupBy(waiting, (o) => o.slot.id);
    const nextWaiting = [...waitingBySlot.values()]
      .map((list) => ({ slot: list[0]!.slot, count: list.length, districts: uniq(list.map((o) => o.district)) }))
      .sort((a, b) => a.slot.startTime.localeCompare(b.slot.startTime))
      .find((g) => tehranTime(date, g.slot.endTime) > now);

    return {
      date,
      updatedAt: now,
      kpis: {
        ordersToday: orders.length,
        byChannel: [...byChannel.values()].sort((a, b) => b.count - a.count || a.sortOrder - b.sortOrder),
        waitingAssignment: waiting.length,
        nextWaitingSlot: nextWaiting ? { slot: nextWaiting.slot, count: nextWaiting.count } : null,
        completed: completed.length,
        completedPercent: orders.length ? Math.round((completed.length / orders.length) * 100) : 0,
        salesRial,
        grossProfitRial,
      },
      byStatus: (['CREATED', 'ASSIGNED', 'EN_ROUTE', 'INSTALLING', 'COMPLETED', 'CANCELLED'] as const).map((s) => ({
        status: s,
        // Design shows 6 bars: accepted counts with assigned, on-site with installing.
        count:
          (byStatus.get(s) ?? 0) +
          (s === 'ASSIGNED' ? (byStatus.get('ACCEPTED') ?? 0) : 0) +
          (s === 'INSTALLING' ? (byStatus.get('ON_SITE') ?? 0) : 0),
      })),
      alerts: await this.alerts(branchId, date, now, orders, waitingBySlot),
      technicians: await this.technicians(branchId, day),
    };
  }

  private async alerts(
    branchId: string | undefined,
    date: string,
    now: Date,
    orders: { id: string; code: string; status: OrderStatus; district: number; slot: { id: string; label: string; startTime: string; endTime: string }; mission: { technician: { fullName: string; phone: string } } | null }[],
    waitingBySlot: Map<string, typeof orders>,
  ) {
    const minutesUntil = (hhmm: string) => Math.round((tehranTime(date, hhmm).getTime() - now.getTime()) / 60_000);

    const unassigned = [...waitingBySlot.values()]
      .map((list) => ({
        type: 'UNASSIGNED' as const,
        severity: 'HIGH' as const,
        slot: list[0]!.slot,
        count: list.length,
        districts: uniq(list.map((o) => o.district)),
        minutesLeft: minutesUntil(list[0]!.slot.startTime),
      }))
      .filter((a) => a.minutesLeft <= BUSINESS_RULES.alerts.unassignedWithinMinutes && minutesUntil(a.slot.endTime) > 0);

    const late = orders
      .filter((o) => ['ASSIGNED', 'ACCEPTED', 'EN_ROUTE'].includes(o.status))
      .map((o) => ({ o, minutesLate: -minutesUntil(o.slot.startTime) }))
      .filter(({ minutesLate }) => minutesLate >= BUSINESS_RULES.alerts.lateArrivalMinutes)
      .map(({ o, minutesLate }) => ({
        type: 'LATE_ARRIVAL' as const,
        severity: 'HIGH' as const,
        orderId: o.id,
        code: o.code,
        technician: o.mission?.technician ?? null,
        minutesLate,
      }));

    const tomorrow = dateOnly(addDays(date, 1));
    const lowStockRows = await this.prisma.$queryRaw<
      { batteryId: string; nameFa: string; branchName: string; available: number; reservedTomorrow: number }[]
    >`
      SELECT s."batteryId", b."nameFa", br.name AS "branchName",
             (s."onHand" - s.reserved)::int AS available,
             (SELECT COUNT(*)::int FROM "Order" o
               WHERE o."branchId" = s."branchId" AND o."batteryId" = s."batteryId"
                 AND o."scheduledDate" = ${tomorrow} AND o.status NOT IN ('COMPLETED', 'CANCELLED')) AS "reservedTomorrow"
      FROM "Stock" s JOIN "Battery" b ON b.id = s."batteryId" JOIN "Branch" br ON br.id = s."branchId"
      WHERE b."isActive" AND s."onHand" - s.reserved <= ${BUSINESS_RULES.alerts.lowStockAvailable}
        ${branchId ? Prisma.sql`AND s."branchId" = ${branchId}::uuid` : Prisma.empty}
      ORDER BY available, b."nameFa"`;
    const lowStock = lowStockRows.map((r) => ({ type: 'LOW_STOCK' as const, severity: 'MEDIUM' as const, ...r }));

    const since = new Date(now.getTime() - BUSINESS_RULES.alerts.discrepancyDays * 86_400_000);
    const mismatches = await this.prisma.payment.findMany({
      where: { status: 'PAID', paidAt: { gte: since }, order: { branchId } },
      select: { amountRial: true, expectedRial: true, order: { select: { id: true, code: true } } },
      orderBy: { paidAt: 'desc' },
    });
    const discrepancies = mismatches
      .filter((p) => p.amountRial !== p.expectedRial)
      .map((p) => ({
        type: 'SETTLEMENT_MISMATCH' as const,
        severity: 'MEDIUM' as const,
        orderId: p.order.id,
        code: p.order.code,
        differenceRial: p.expectedRial - p.amountRial,
      }));

    return [...unassigned, ...late, ...lowStock, ...discrepancies];
  }

  private async technicians(branchId: string | undefined, day: Date) {
    const loads = await technicianLoads(this.prisma, branchId, day);
    return loads.map((t) => {
      const statuses = t.missions.map((m) => m.status as OrderStatus);
      const busy = CURRENT_PRIORITY.find((s) => statuses.includes(s));
      return {
        id: t.id,
        fullName: t.fullName,
        serviceDistricts: t.serviceDistricts,
        dailyCapacity: t.dailyCapacity,
        load: t.load,
        openMissions: statuses.filter((s) => ACTIVE_MISSION_STATUSES.includes(s)).length,
        /** EN_ROUTE / ON_SITE / INSTALLING, or FREE / FULL when not on a job. */
        current: busy ?? (t.load >= t.dailyCapacity ? 'FULL' : 'FREE'),
      };
    });
  }

}

function countBy<T, K>(xs: T[], key: (x: T) => K) {
  const m = new Map<K, number>();
  for (const x of xs) m.set(key(x), (m.get(key(x)) ?? 0) + 1);
  return m;
}
function groupBy<T, K>(xs: T[], key: (x: T) => K) {
  const m = new Map<K, T[]>();
  for (const x of xs) m.set(key(x), [...(m.get(key(x)) ?? []), x]);
  return m;
}
const uniq = <T>(xs: T[]) => [...new Set(xs)];
