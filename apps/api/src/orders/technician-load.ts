import type { TechnicianFit } from '@amprex/shared';
import { BUSINESS_RULES } from '../config/business-rules.js';
import type { PrismaService } from '../prisma/prisma.service.js';

export interface TechnicianLoad {
  id: string;
  fullName: string;
  phone: string;
  userId: string | null;
  serviceDistricts: number[];
  dailyCapacity: number;
  /** Non-cancelled missions scheduled that day. */
  load: number;
  missions: { orderId: string; slotId: string; district: number; status: string }[];
}

/** Active technicians of a branch with their missions on one day. */
export async function technicianLoads(
  prisma: PrismaService,
  branchId: string | undefined,
  day: Date,
): Promise<TechnicianLoad[]> {
  const technicians = await prisma.technician.findMany({
    where: { branchId, isActive: true },
    orderBy: { fullName: 'asc' },
    include: {
      missions: {
        where: { order: { scheduledDate: day, status: { not: 'CANCELLED' } } },
        select: { order: { select: { id: true, slotId: true, district: true, status: true } } },
      },
    },
  });
  return technicians.map((t) => ({
    id: t.id,
    fullName: t.fullName,
    phone: t.phone,
    userId: t.userId,
    serviceDistricts: t.serviceDistricts,
    dailyCapacity: t.dailyCapacity,
    load: t.missions.length,
    missions: t.missions.map((m) => ({
      orderId: m.order.id,
      slotId: m.order.slotId,
      district: m.order.district,
      status: m.order.status,
    })),
  }));
}

/**
 * Ranks technicians for one order (design: assignment sheet). Full technicians cannot be
 * picked; among the rest, the system suggests the one already working in the order's district
 * that day (shorter routes), then the least loaded.
 */
export function rankForOrder(
  loads: TechnicianLoad[],
  order: { id: string; district: number; slotId: string },
) {
  const rows = loads.map((t) => {
    const others = t.missions.filter((m) => m.orderId !== order.id);
    const load = others.length;
    return {
      ...t,
      load,
      isCurrent: t.missions.some((m) => m.orderId === order.id),
      inZone: t.serviceDistricts.includes(order.district),
      zoneJobs: others.filter((m) => m.district === order.district).length,
      slotJobs: others.filter((m) => m.slotId === order.slotId).length,
      full: load >= t.dailyCapacity,
    };
  });
  const recommended = rows
    .filter((r) => r.inZone && !r.full)
    .sort((a, b) => b.zoneJobs - a.zoneJobs || a.load - b.load)[0];

  return rows
    .map((r) => {
      const fit: TechnicianFit = r.full
        ? 'FULL'
        : r.id === recommended?.id
          ? 'RECOMMENDED'
          : r.load / r.dailyCapacity >= BUSINESS_RULES.technicianBusyRatio
            ? 'BUSY'
            : 'FREE';
      const { missions: _missions, ...rest } = r;
      return { ...rest, fit };
    })
    .sort((a, b) => Number(b.fit === 'RECOMMENDED') - Number(a.fit === 'RECOMMENDED') || Number(a.full) - Number(b.full));
}
