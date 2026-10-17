import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import { scopedBranchId } from '../auth/scope.js';
import { BranchesService } from './branches.service.js';

@ApiTags('branches')
@ApiBearerAuth()
@Controller('branches')
export class BranchesController {
  constructor(private readonly branches: BranchesService) {}

  /** All branches for SUPER_ADMIN; own branch for everyone else. */
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.branches.list(scopedBranchId(user));
  }
}
