import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { scopedBranchId } from '../auth/scope.js';
import { dateOnly, tehranDate } from '../common/tehran-time.js';
import { technicianLoads } from '../orders/technician-load.js';
import { PrismaService } from '../prisma/prisma.service.js';

class TechniciansQuery {
  @IsOptional()
  @IsUUID()
  branchId?: string;
}

@ApiTags('users')
@ApiBearerAuth()
@Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'OPERATOR')
@Controller('users')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  /** Active technicians with zones and today's load. Per-order ranking: GET /orders/:id/technicians. */
  @Get('technicians')
  async technicians(@CurrentUser() user: AuthUser, @Query() q: TechniciansQuery) {
    const loads = await technicianLoads(this.prisma, scopedBranchId(user, q.branchId), dateOnly(tehranDate()));
    return loads.map(({ missions: _missions, ...t }) => t);
  }
}
