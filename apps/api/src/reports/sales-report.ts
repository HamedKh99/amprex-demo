import { addDays, tehranDayStart } from '../common/tehran-time.js';
import { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';

export const SALES_GROUPS = ['product', 'channel', 'product_channel'] as const;
export type SalesGroup = (typeof SALES_GROUPS)[number];

export interface Sums {
  count: number;
  grossRial: bigint;
  creditRial: bigint;
  netRial: bigint;
  costRial: bigint;
}

/** Margin = gross profit ÷ net received, one decimal, in percent. */
const withProfit = <T extends Sums>(r: T) => {
  const profitRial = r.netRial - r.costRial;
  return {
    ...r,
    profitRial,
    marginPercent: r.netRial > 0n ? Math.round(Number((profitRial * 1000n) / r.netRial)) / 10 : 0,
  };
};

/**
 * Design «گزارش فروش و سود»: COMPLETED orders by completion day (Tehran).
 * gross = battery price + install fee; credit = old-battery credit; net = payable;
 * cost = battery cost − scrap value of the returned old battery; profit = net − cost.
 */
export async function salesReport(
  prisma: PrismaService,
  q: { from: string; to: string; branchId?: string; groupBy: SalesGroup },
) {
  const start = tehranDayStart(q.from);
  const end = tehranDayStart(addDays(q.to, 1));
  const byProduct = q.groupBy !== 'channel';
  const byChannel = q.groupBy !== 'product';
  const keys = [
    ...(byProduct ? [Prisma.sql`b.sku`, Prisma.sql`b."nameFa"`, Prisma.sql`b."capacityAh"`] : []),
    ...(byChannel ? [Prisma.sql`c.code`, Prisma.sql`c."nameFa"`, Prisma.sql`c."sortOrder"`] : []),
  ];

  const rows = await prisma.$queryRaw<
    (Sums & { sku: string | null; productNameFa: string | null; channelCode: string | null; channelNameFa: string | null })[]
  >`
    SELECT ${byProduct ? Prisma.sql`b.sku, b."nameFa" AS "productNameFa"` : Prisma.sql`NULL AS sku, NULL AS "productNameFa"`},
           ${byChannel ? Prisma.sql`c.code AS "channelCode", c."nameFa" AS "channelNameFa"` : Prisma.sql`NULL AS "channelCode", NULL AS "channelNameFa"`},
           COUNT(*)::int AS count,
           SUM(o."batteryPriceRial" + o."installFeeRial")::bigint AS "grossRial",
           SUM(o."coreCreditRial")::bigint AS "creditRial",
           SUM(o."totalRial")::bigint AS "netRial",
           SUM(o."batteryCostRial" - COALESCE(cr."scrapValueRial", 0))::bigint AS "costRial"
    FROM "Order" o
    JOIN "Battery" b ON b.id = o."batteryId"
    JOIN "Channel" c ON c.id = o."channelId"
    LEFT JOIN "CoreReturn" cr ON cr."orderId" = o.id
    WHERE o.status = 'COMPLETED' AND o."completedAt" >= ${start} AND o."completedAt" < ${end}
      ${q.branchId ? Prisma.sql`AND o."branchId" = ${q.branchId}::uuid` : Prisma.empty}
    GROUP BY ${Prisma.join(keys)}
    ORDER BY "netRial" DESC`;

  const totals = rows.reduce<Sums>(
    (t, r) => ({
      count: t.count + r.count,
      grossRial: t.grossRial + r.grossRial,
      creditRial: t.creditRial + r.creditRial,
      netRial: t.netRial + r.netRial,
      costRial: t.costRial + r.costRial,
    }),
    { count: 0, grossRial: 0n, creditRial: 0n, netRial: 0n, costRial: 0n },
  );
  return { range: { from: q.from, to: q.to, branchId: q.branchId ?? null }, groupBy: q.groupBy, totals: withProfit(totals), rows: rows.map(withProfit) };
}
