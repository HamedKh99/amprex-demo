import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { scopedBranchId } from '../auth/scope.js';
import { DashboardService } from './dashboard.service.js';

class DashboardQuery {
  /** SUPER_ADMIN only; other roles always see their own branch. */
  @IsOptional()
  @IsUUID()
  branchId?: string;
}

@ApiTags('dashboard')
@ApiBearerAuth()
@Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'OPERATOR')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  /** Today (Tehran): KPIs, status bars, alerts and technicians. Gross profit only for managers. */
  @Get()
  async today(@CurrentUser() user: AuthUser, @Query() q: DashboardQuery) {
    const data = await this.dashboard.today(scopedBranchId(user, q.branchId));
    if (user.role === 'OPERATOR') return { ...data, kpis: { ...data.kpis, grossProfitRial: null } };
    return data;
  }
}
