import { Controller, Get, HttpStatus, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsUUID, Matches } from 'class-validator';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { scopedBranchId } from '../auth/scope.js';
import { AppException } from '../common/app-exception.js';
import { DATE_ONLY } from '../common/transforms.js';
import { ReportsService } from './reports.service.js';

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

const MAX_DAYS = 366;

@ApiTags('reports')
@ApiBearerAuth()
@Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('summary')
  summary(@CurrentUser() user: AuthUser, @Query() q: ReportQuery) {
    const range = { ...this.reports.defaultRange(), ...stripUndefined({ from: q.from, to: q.to }) };
    const days = (Date.parse(range.to) - Date.parse(range.from)) / 86_400_000;
    if (!(days >= 0 && days < MAX_DAYS)) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        'بازه گزارش نامعتبر است (حداکثر یک سال).',
        range,
      );
    }
    return this.reports.summary({ ...range, branchId: scopedBranchId(user, q.branchId) });
  }
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}
