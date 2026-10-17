import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { scopedBranchId } from '../auth/scope.js';
import { notFound } from '../common/app-exception.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ReceiptDto, StockQuery } from './inventory.dto.js';
import { StockService } from './stock.service.js';

@ApiTags('inventory')
@ApiBearerAuth()
@Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'OPERATOR')
@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
  ) {}

  /** Stock per branch and battery, with available = onHand − reserved. */
  @Get('stock')
  async list(@CurrentUser() user: AuthUser, @Query() q: StockQuery) {
    const branchId = scopedBranchId(user, q.branchId);
    const rows = await this.prisma.stock.findMany({
      where: { branchId },
      include: {
        branch: { select: { id: true, code: true, name: true } },
        battery: { select: { id: true, sku: true, nameFa: true, capacityAh: true, isActive: true } },
      },
      orderBy: [{ branch: { code: 'asc' } }, { battery: { capacityAh: 'asc' } }, { battery: { sku: 'asc' } }],
    });
    return rows.map((r) => ({ ...r, available: r.onHand - r.reserved }));
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Post('receipts')
  async receive(@CurrentUser() user: AuthUser, @Body() dto: ReceiptDto) {
    const branchId = scopedBranchId(user, dto.branchId)!;
    const battery = await this.prisma.battery.findUnique({ where: { id: dto.batteryId } });
    if (!battery) throw notFound('باتری');
    const stock = await this.stock.receive({ ...dto, branchId, actorUserId: user.id });
    return { ...stock, available: stock.onHand - stock.reserved };
  }
}
