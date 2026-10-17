import { Injectable } from '@nestjs/common';
import type { StockMovementType } from '@amprex/shared';
import { notFound } from '../common/app-exception.js';
import { addDays, tehranDate, tehranDayStart } from '../common/tehran-time.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type LedgerType = StockMovementType | 'CORE_RETURN';

export interface LedgerRow {
  id: string;
  at: Date;
  type: LedgerType;
  /** Signed effect as shown: free units for RESERVE/RELEASE, units on hand otherwise, +1 per returned core. */
  quantity: number;
  /** Units on hand of that product after the row (returned cores: cores held). */
  balance: number;
  sku: string | null;
  productNameFa: string | null;
  /** Ah of a returned old battery (CORE_RETURN rows). */
  coreAh: number | null;
  reference: string | null;
  actorName: string | null;
  note: string | null;
}

/** Stock screen and ledger («دفتر گردش کالا») for one branch. */
@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async stock(branchId: string) {
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId }, select: { id: true, code: true, name: true } });
    if (!branch) throw notFound('شعبه');
    const rows = await this.prisma.stock.findMany({
      where: { branchId, battery: { isActive: true } },
      include: { battery: { select: { id: true, sku: true, nameFa: true, capacityAh: true } } },
      orderBy: [{ battery: { capacityAh: 'asc' } }, { battery: { sku: 'asc' } }],
    });
    const items = rows.map((r) => {
      const available = r.onHand - r.reserved;
      return {
        id: r.id,
        battery: r.battery,
        onHand: r.onHand,
        reserved: r.reserved,
        available,
        reorderPoint: r.reorderPoint,
        belowReorder: available < r.reorderPoint,
      };
    });
    // Returned old batteries held by the branch (no recycling dispatch is tracked yet).
    const core = await this.prisma.coreReturn.aggregate({
      where: { returned: true, order: { branchId } },
      _count: true,
      _sum: { ampereHours: true },
    });
    return {
      branch,
      items,
      totals: {
        onHand: items.reduce((s, i) => s + i.onHand, 0),
        reserved: items.reduce((s, i) => s + i.reserved, 0),
        available: items.reduce((s, i) => s + i.available, 0),
      },
      belowReorderCount: items.filter((i) => i.belowReorder).length,
      core: { count: core._count, ampereHours: core._sum.ampereHours ?? 0 },
    };
  }

  /**
   * Movements of one branch in [from, to] (Tehran days, default today), newest first.
   * Balances are window sums over the full history, so they are right even for a short range.
   */
  async ledger(branchId: string, q: { from?: string; to?: string; type?: LedgerType }): Promise<LedgerRow[]> {
    const from = q.from ?? tehranDate();
    const to = q.to ?? from;
    const start = tehranDayStart(from);
    const end = tehranDayStart(addDays(to, 1));
    const typeFilter = q.type ? Prisma.sql`AND type = ${q.type}` : Prisma.empty;

    return this.prisma.$queryRaw<LedgerRow[]>`
      WITH moves AS (
        SELECT m.id, m."createdAt" AS at, m.type::text AS type,
               CASE WHEN m.type IN ('RESERVE', 'RELEASE') THEN -m.quantity ELSE m.quantity END AS quantity,
               SUM(CASE WHEN m.type IN ('RECEIPT', 'ISSUE', 'ADJUST', 'TRANSFER') THEN m.quantity ELSE 0 END)
                 OVER (PARTITION BY m."batteryId" ORDER BY m."createdAt", m.id) AS balance,
               b.sku, b."nameFa" AS "productNameFa", NULL::int AS "coreAh",
               COALESCE(m.reference, o.code) AS reference, u."fullName" AS "actorName", m.note
        FROM "StockMovement" m
        JOIN "Battery" b ON b.id = m."batteryId"
        LEFT JOIN "Order" o ON o.id = m."orderId"
        LEFT JOIN "User" u ON u.id = m."actorUserId"
        WHERE m."branchId" = ${branchId}::uuid
      ),
      cores AS (
        SELECT cr.id, cr."recordedAt" AS at, 'CORE_RETURN' AS type, 1 AS quantity,
               COUNT(*) OVER (ORDER BY cr."recordedAt", cr.id) AS balance,
               NULL AS sku, NULL AS "productNameFa", cr."ampereHours" AS "coreAh",
               o.code AS reference, t."fullName" AS "actorName", NULL AS note
        FROM "CoreReturn" cr
        JOIN "Order" o ON o.id = cr."orderId"
        LEFT JOIN "Mission" mi ON mi."orderId" = o.id
        LEFT JOIN "Technician" t ON t.id = mi."technicianId"
        WHERE cr.returned AND o."branchId" = ${branchId}::uuid
      )
      SELECT id, at, type, quantity::int, balance::int, sku, "productNameFa", "coreAh", reference, "actorName", note
      FROM (SELECT * FROM moves UNION ALL SELECT * FROM cores) x
      WHERE at >= ${start} AND at < ${end} ${typeFilter}
      ORDER BY at DESC, id DESC
      LIMIT 300`;
  }
}
