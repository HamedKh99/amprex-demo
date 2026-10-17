import { Controller, Get, HttpStatus, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID, Matches } from 'class-validator';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { scopedBranchId } from '../auth/scope.js';
import { AppException } from '../common/app-exception.js';
import { DATE_ONLY } from '../common/transforms.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ReportsService } from './reports.service.js';
import { SALES_GROUPS, type SalesGroup, salesReport } from './sales-report.js';

class ReportQuery {
  /** "YYYY-MM-DD" (Tehran day). Defaults to the last 30 days. */
  @IsOptional()
  @Matches(DATE_ONLY)
  from?: string;

  @IsOptional()
  @Matches(DATE_ONLY)
  to?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}

class SalesQuery extends ReportQuery {
  @IsOptional()
  @IsIn(SALES_GROUPS)
  groupBy: SalesGroup = 'product_channel';
}

const MAX_DAYS = 366;

@ApiTags('reports')
@ApiBearerAuth()
@Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('summary')
  summary(@CurrentUser() user: AuthUser, @Query() q: ReportQuery) {
    return this.reports.summary({ ...this.range(q), branchId: scopedBranchId(user, q.branchId) });
  }

  /** «گزارش فروش و سود»: completed orders by product, channel or both. */
  @Get('sales')
  sales(@CurrentUser() user: AuthUser, @Query() q: SalesQuery) {
    return salesReport(this.prisma, { ...this.range(q), branchId: scopedBranchId(user, q.branchId), groupBy: q.groupBy });
  }

  private range(q: ReportQuery) {
    const range = { ...this.reports.defaultRange(), ...stripUndefined({ from: q.from, to: q.to }) };
    const days = (Date.parse(range.to) - Date.parse(range.from)) / 86_400_000;
    if (!(days >= 0 && days < MAX_DAYS)) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', 'بازه گزارش نامعتبر است (حداکثر یک سال).', range);
    }
    return range;
  }
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}
