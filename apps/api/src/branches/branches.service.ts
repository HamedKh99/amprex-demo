import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../common/app-exception.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  /** The active branch serving a Tehran district (assumption: districts don't overlap). */
  async forDistrict(district: number) {
    const branch = await this.prisma.branch.findFirst({
      where: { isActive: true, serviceDistricts: { has: district } },
    });
    if (!branch) {
      throw new AppException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'DISTRICT_NOT_COVERED',
        'در حال حاضر در این منطقه خدمات ارائه نمی‌شود.',
        { district },
      );
    }
    return branch;
  }

  list(branchId?: string) {
    return this.prisma.branch.findMany({
      where: { id: branchId },
      orderBy: { code: 'asc' },
    });
  }
}
