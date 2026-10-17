import { Body, Controller, Get, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { scopedBranchId } from '../auth/scope.js';
import { AppException, notFound } from '../common/app-exception.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BranchQuery, LedgerQuery, ReceiptDto, TransferDto } from './inventory.dto.js';
import { InventoryService } from './inventory.service.js';
import { StockService } from './stock.service.js';

@ApiTags('inventory')
@ApiBearerAuth()
@Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'OPERATOR')
@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly stock: StockService,
  ) {}

  /** One branch: free = on hand − reserved, reorder status, totals, returned old batteries. */
  @Get('stock')
  async list(@CurrentUser() user: AuthUser, @Query() q: BranchQuery) {
    return this.inventory.stock(this.branchOf(user, q.branchId));
  }

  /** «دفتر گردش کالا» for one branch. */
  @Get('movements')
  ledger(@CurrentUser() user: AuthUser, @Query() q: LedgerQuery) {
    return this.inventory.ledger(this.branchOf(user, q.branchId), q);
  }

  /** «ثبت ورود کالا» */
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Post('receipts')
  async receive(@CurrentUser() user: AuthUser, @Body() dto: ReceiptDto) {
    const branchId = scopedBranchId(user, dto.branchId)!;
    await this.assertBattery(dto.batteryId);
    return this.stock.receive({ ...dto, branchId, actorUserId: user.id });
  }

  /** «انتقال بین انبارها»: a branch manager can only send from their own branch. */
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Post('transfers')
  async transfer(@CurrentUser() user: AuthUser, @Body() dto: TransferDto) {
    const fromBranchId = scopedBranchId(user, dto.fromBranchId)!;
    if (fromBranchId === dto.toBranchId) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', 'انبار مبدأ و مقصد باید متفاوت باشند.');
    }
    const target = await this.prisma.branch.findFirst({ where: { id: dto.toBranchId, isActive: true } });
    if (!target) throw notFound('انبار مقصد');
    await this.assertBattery(dto.batteryId);
    return this.stock.transfer({ ...dto, fromBranchId, actorUserId: user.id });
  }

  private branchOf(user: AuthUser, requested?: string) {
    const branchId = scopedBranchId(user, requested);
    if (!branchId) throw new AppException(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', 'شعبه را انتخاب کنید.');
    return branchId;
  }

  private async assertBattery(id: string) {
    if (!(await this.prisma.battery.findUnique({ where: { id } }))) throw notFound('باتری');
  }
}
