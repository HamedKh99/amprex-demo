import type { Prisma } from '../generated/prisma/client.js';
import { forbidden } from '../common/app-exception.js';
import type { AuthUser } from './auth.types.js';

/**
 * Row-level visibility of orders:
 * SUPER_ADMIN → all; BRANCH_MANAGER / OPERATOR → own branch; TECHNICIAN → own missions.
 */
export function orderScope(user: AuthUser): Prisma.OrderWhereInput {
  switch (user.role) {
    case 'SUPER_ADMIN':
      return {};
    case 'TECHNICIAN':
      return user.technicianId
        ? { mission: { is: { technicianId: user.technicianId } } }
        : { id: { in: [] } };
    default:
      return { branchId: user.branchId ?? '' };
  }
}

/**
 * Branch filter for branch-level data (stock, reports, technicians).
 * Returns undefined for "all branches" (SUPER_ADMIN without a filter).
 */
export function scopedBranchId(user: AuthUser, requested?: string): string | undefined {
  if (user.role === 'SUPER_ADMIN') return requested;
  if (requested && requested !== user.branchId) throw forbidden('دسترسی شما محدود به شعبه خودتان است.');
  return user.branchId ?? '';
}
