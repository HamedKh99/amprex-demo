import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { scopedBranchId } from '../auth/scope.js';
import { dateOnly, tehranDate } from '../common/tehran-time.js';
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

  /** Active technicians with today's and open workload, for the assignment picker. */
  @Get('technicians')
  async technicians(@CurrentUser() user: AuthUser, @Query() q: TechniciansQuery) {
    const branchId = scopedBranchId(user, q.branchId);
    const today = dateOnly(tehranDate());
    const technicians = await this.prisma.technician.findMany({
      where: { branchId, isActive: true },
      include: { branch: { select: { id: true, name: true } } },
      orderBy: { fullName: 'asc' },
    });
    const open = await this.prisma.mission.groupBy({
      by: ['technicianId'],
      where: {
        technicianId: { in: technicians.map((t) => t.id) },
        order: { status: { in: ['ASSIGNED', 'EN_ROUTE', 'ON_SITE'] } },
      },
      _count: true,
    });
    const todays = await this.prisma.mission.groupBy({
      by: ['technicianId'],
      where: {
        technicianId: { in: technicians.map((t) => t.id) },
        order: { scheduledDate: today, status: { not: 'CANCELLED' } },
      },
      _count: true,
    });
    const openBy = new Map(open.map((o) => [o.technicianId, o._count]));
    const todayBy = new Map(todays.map((o) => [o.technicianId, o._count]));
    return technicians.map((t) => ({
      ...t,
      openMissions: openBy.get(t.id) ?? 0,
      todayMissions: todayBy.get(t.id) ?? 0,
    }));
  }
}
