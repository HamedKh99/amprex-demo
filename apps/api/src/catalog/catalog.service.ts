import { Injectable } from '@nestjs/common';
import { BranchesService } from '../branches/branches.service.js';
import { notFound } from '../common/app-exception.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { quote } from '../pricing/pricing.js';

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branches: BranchesService,
  ) {}

  vehicles() {
    return this.prisma.vehicleModel.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { nameFa: 'asc' }],
    });
  }

  batteries() {
    return this.prisma.battery.findMany({
      where: { isActive: true },
      orderBy: [{ capacityAh: 'asc' }, { priceRial: 'asc' }],
    });
  }

  /**
   * Batteries that fit a vehicle, recommended first, each with its price quote and
   * (when a district is given) whether the serving branch has a free unit.
   */
  async compatibleBatteries(vehicleModelId: string, district?: number, coreReturn = true) {
    const vehicle = await this.prisma.vehicleModel.findFirst({
      where: { id: vehicleModelId, isActive: true },
    });
    if (!vehicle) throw notFound('مدل خودرو');

    const links = await this.prisma.batteryCompatibility.findMany({
      where: { vehicleModelId, battery: { isActive: true } },
      include: { battery: true },
      orderBy: [{ isRecommended: 'desc' }, { battery: { priceRial: 'asc' } }],
    });

    const branch = district ? await this.branches.forDistrict(district) : null;
    const stock = branch
      ? await this.prisma.stock.findMany({
          where: { branchId: branch.id, batteryId: { in: links.map((l) => l.batteryId) } },
        })
      : [];
    const free = new Map(stock.map((s) => [s.batteryId, s.onHand - s.reserved]));

    return {
      vehicle,
      branch: branch && { id: branch.id, name: branch.name },
      batteries: links.map(({ battery, isRecommended }) => ({
        ...battery,
        isRecommended,
        price: quote(battery, coreReturn),
        inStock: branch ? (free.get(battery.id) ?? 0) > 0 : null,
      })),
    };
  }
}
