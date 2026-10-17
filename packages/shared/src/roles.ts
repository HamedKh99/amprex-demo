export const ROLES = ['SUPER_ADMIN', 'BRANCH_MANAGER', 'OPERATOR', 'TECHNICIAN'] as const;
export type Role = (typeof ROLES)[number];

/** Roles that only see data of their own branch (TECHNICIAN: only own missions). */
export const BRANCH_SCOPED_ROLES: readonly Role[] = ['BRANCH_MANAGER', 'OPERATOR', 'TECHNICIAN'];

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'مدیر کل',
  BRANCH_MANAGER: 'مدیر شعبه',
  OPERATOR: 'اپراتور',
  TECHNICIAN: 'تکنسین',
};
