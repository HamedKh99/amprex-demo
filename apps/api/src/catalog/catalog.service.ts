import { Injectable } from '@nestjs/common';
import { toLatinDigits, toPersianDigits } from '@amprex/shared';
import { BranchesService } from '../branches/branches.service.js';
import { notFound } from '../common/app-exception.js';
import { BUSINESS_RULES } from '../config/business-rules.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { finalPriceExamples, quote } from '../pricing/pricing.js';
import type { VehiclesQuery } from './catalog.dto.js';

// Public battery fields: never the cost price.
const publicBattery = {
  id: true,
  sku: true,
  brand: true,
  series: true,
  nameFa: true,
  capacityAh: true,
  coldCrankingA: true,
  voltage: true,
  groupSize: true,
  warrantyMonths: true,
  priceRial: true,
} as const;


@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branches: BranchesService,
  ) {}

  /** Brands per vehicle type, in catalogue order. */
  async brands() {
    const rows = await this.prisma.vehicleModel.findMany({
      where: { isActive: true },
      select: { type: true, brandFa: true },
      orderBy: { sortOrder: 'asc' },
    });
    const seen = new Set<string>();
    return rows.filter((r) => {
      const key = `${r.type}|${r.brandFa}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  vehicles(q: VehiclesQuery) {
    // Names store Persian digits («۲۰۶»); match either script.
    const search = q.q?.trim();
    return this.prisma.vehicleModel.findMany({
      where: {
        isActive: true,
        type: q.type,
        brandFa: q.brand,
        ...(search && {
          OR: [
            { nameFa: { contains: toPersianDigits(toLatinDigits(search)) } },
            { model: { contains: toLatinDigits(search), mode: 'insensitive' } },
          ],
        }),
      },
      orderBy: [{ sortOrder: 'asc' }, { nameFa: 'asc' }],
    });
  }

  /**
   * Batteries that fit a vehicle: factory-spec matches first, then alternatives. Each carries
   * its price estimate, the final-price examples and (with a district) stock at the serving branch.
   */
  async compatibleBatteries(vehicleModelId: string, district?: number, availableOnly = false) {
    const vehicle = await this.prisma.vehicleModel.findFirst({
      where: { id: vehicleModelId, isActive: true },
    });
    if (!vehicle) throw notFound('مدل خودرو');

    const links = await this.prisma.batteryCompatibility.findMany({
      where: { vehicleModelId, battery: { isActive: true } },
      include: { battery: { select: publicBattery } },
      orderBy: [{ matchesFactorySpec: 'desc' }, { battery: { priceRial: 'asc' } }],
    });

    const branch = district ? await this.branches.forDistrict(district) : null;
    const stock = branch
      ? await this.prisma.stock.findMany({
          where: { branchId: branch.id, batteryId: { in: links.map((l) => l.batteryId) } },
        })
      : [];
    const free = new Map(stock.map((s) => [s.batteryId, s.onHand - s.reserved]));

    const batteries = links
      .map(({ battery, matchesFactorySpec }) => ({
        ...battery,
        matchesFactorySpec,
        price: quote(battery),
        finalPriceExamples: finalPriceExamples(battery),
        inStock: branch ? (free.get(battery.id) ?? 0) > 0 : null,
      }))
      .filter((b) => !(availableOnly && branch) || b.inStock);

    return {
      vehicle,
      branch: branch && { id: branch.id, name: branch.name },
      coreCreditPerAhRial: BUSINESS_RULES.coreCreditPerAhRial,
      batteries,
    };
  }
}
