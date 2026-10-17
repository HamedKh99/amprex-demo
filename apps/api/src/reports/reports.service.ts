import { Injectable } from '@nestjs/common';
import { addDays, tehranDate, tehranDayStart } from '../common/tehran-time.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BUSINESS_RULES } from '../config/business-rules.js';

export interface ReportRange {
  from: string;
  to: string;
  branchId?: string;
}

/**
 * Admin report. Every figure covers orders CREATED in [from, to] (Tehran days), and revenue is
 * the PAID payments of those orders, so the breakdowns add up to the KPIs.
 */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  defaultRange(): { from: string; to: string } {
    const to = tehranDate();
    return { from: addDays(to, -29), to };
  }

  async summary({ from, to, branchId }: ReportRange) {
    const start = tehranDayStart(from);
    const end = tehranDayStart(addDays(to, 1));
    const tz = BUSINESS_RULES.timezone;
    // Orders in range with their paid amount; every query below reads from this CTE.
    const ord = Prisma.sql`
      WITH ord AS (
        SELECT o.*, COALESCE(pay.amount, 0)::bigint AS paid
        FROM "Order" o
        LEFT JOIN (
          SELECT "orderId", SUM("amountRial") AS amount FROM "Payment"
          WHERE status = 'PAID' GROUP BY "orderId"
        ) pay ON pay."orderId" = o.id
        WHERE o."createdAt" >= ${start} AND o."createdAt" < ${end}
        ${branchId ? Prisma.sql`AND o."branchId" = ${branchId}::uuid` : Prisma.empty}
      )`;
    const q = <T>(body: Prisma.Sql) => this.prisma.$queryRaw<T[]>(Prisma.sql`${ord} ${body}`);

    const [kpiRows, byStatus, byChannel, byBattery, byBranch, daily, byTechnician, coreReturns] =
      await Promise.all([
        q<{
          orders: number;
          completed: number;
          cancelled: number;
          open: number;
          paidOrders: number;
          revenueRial: bigint;
          grossProfitRial: bigint;
          avgLeadHours: number | null;
        }>(Prisma.sql`
          SELECT COUNT(*)::int AS orders,
                 COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed,
                 COUNT(*) FILTER (WHERE status = 'CANCELLED')::int AS cancelled,
                 COUNT(*) FILTER (WHERE status NOT IN ('COMPLETED', 'CANCELLED'))::int AS open,
                 COUNT(*) FILTER (WHERE paid > 0)::int AS "paidOrders",
                 COALESCE(SUM(paid), 0)::bigint AS "revenueRial",
                 COALESCE(SUM(ord."totalRial" - ord."batteryCostRial" + COALESCE(cr."scrapValueRial", 0))
                   FILTER (WHERE ord.status = 'COMPLETED'), 0)::bigint AS "grossProfitRial",
                 ROUND(AVG(EXTRACT(EPOCH FROM ("completedAt" - "createdAt")) / 3600)
                   FILTER (WHERE status = 'COMPLETED')::numeric, 1)::float8 AS "avgLeadHours"
          FROM ord LEFT JOIN "CoreReturn" cr ON cr."orderId" = ord.id`),
        q<{ status: string; orders: number }>(Prisma.sql`
          SELECT status::text, COUNT(*)::int AS orders FROM ord GROUP BY status ORDER BY orders DESC`),
        q<{ code: string; nameFa: string; orders: number; completed: number; revenueRial: bigint }>(Prisma.sql`
          SELECT c.code, c."nameFa", COUNT(*)::int AS orders,
                 COUNT(*) FILTER (WHERE ord.status = 'COMPLETED')::int AS completed,
                 COALESCE(SUM(ord.paid), 0)::bigint AS "revenueRial"
          FROM ord JOIN "Channel" c ON c.id = ord."channelId"
          GROUP BY c.code, c."nameFa", c."sortOrder" ORDER BY orders DESC, c."sortOrder"`),
        q<{ sku: string; nameFa: string; installed: number; revenueRial: bigint }>(Prisma.sql`
          SELECT b.sku, b."nameFa",
                 COUNT(*) FILTER (WHERE ord.status = 'COMPLETED')::int AS installed,
                 COALESCE(SUM(ord.paid), 0)::bigint AS "revenueRial"
          FROM ord JOIN "Battery" b ON b.id = ord."batteryId"
          GROUP BY b.sku, b."nameFa" ORDER BY installed DESC, b.sku`),
        q<{ id: string; name: string; orders: number; completed: number; revenueRial: bigint }>(Prisma.sql`
          SELECT br.id, br.name, COUNT(*)::int AS orders,
                 COUNT(*) FILTER (WHERE ord.status = 'COMPLETED')::int AS completed,
                 COALESCE(SUM(ord.paid), 0)::bigint AS "revenueRial"
          FROM ord JOIN "Branch" br ON br.id = ord."branchId"
          GROUP BY br.id, br.name, br.code ORDER BY br.code`),
        q<{ date: string; orders: number; completed: number; revenueRial: bigint }>(Prisma.sql`
          SELECT to_char((ord."createdAt" AT TIME ZONE ${tz})::date, 'YYYY-MM-DD') AS date,
                 COUNT(*)::int AS orders,
                 COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed,
                 COALESCE(SUM(paid), 0)::bigint AS "revenueRial"
          FROM ord GROUP BY 1 ORDER BY 1`),
        q<{ id: string; fullName: string; installs: number; avgJobMinutes: number | null }>(Prisma.sql`
          SELECT t.id, t."fullName",
                 COUNT(m."installedAt")::int AS installs,
                 ROUND(AVG(EXTRACT(EPOCH FROM (m."installedAt" - m."departedAt")) / 60)::numeric)::float8
                   AS "avgJobMinutes"
          FROM ord JOIN "Mission" m ON m."orderId" = ord.id JOIN "Technician" t ON t.id = m."technicianId"
          GROUP BY t.id, t."fullName" ORDER BY installs DESC, t."fullName"`),
        q<{ returned: boolean; count: number; ampereHours: number; creditRial: bigint }>(Prisma.sql`
          SELECT cr.returned, COUNT(*)::int AS count,
                 COALESCE(SUM(cr."ampereHours"), 0)::int AS "ampereHours",
                 COALESCE(SUM(cr."creditAppliedRial"), 0)::bigint AS "creditRial"
          FROM ord JOIN "CoreReturn" cr ON cr."orderId" = ord.id
          GROUP BY cr.returned ORDER BY cr.returned DESC`),
      ]);

    const kpi = kpiRows[0]!;
    const installed = coreReturns.reduce((s, r) => s + r.count, 0);
    const returned = coreReturns.filter((r) => r.returned).reduce((s, r) => s + r.count, 0);

    return {
      range: { from, to, branchId: branchId ?? null },
      kpis: {
        ...kpi,
        cancelRate: kpi.orders ? round1((kpi.cancelled / kpi.orders) * 100) : 0,
        avgTicketRial: kpi.paidOrders ? kpi.revenueRial / BigInt(kpi.paidOrders) : 0n,
        coreReturnRate: installed ? round1((returned / installed) * 100) : 0,
      },
      byStatus,
      byChannel,
      byBattery,
      byBranch,
      daily: fillDays(from, to, daily),
      byTechnician,
      coreReturns,
    };
  }
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** One row per day so charts have no gaps. */
function fillDays<T extends { date: string }>(from: string, to: string, rows: T[]) {
  const byDate = new Map(rows.map((r) => [r.date, r]));
  const out: (T | { date: string; orders: number; completed: number; revenueRial: bigint })[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    out.push(byDate.get(d) ?? { date: d, orders: 0, completed: 0, revenueRial: 0n });
  }
  return out;
}
