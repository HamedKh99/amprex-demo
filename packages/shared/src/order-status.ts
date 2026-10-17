import type { Role } from './roles.js';

/**
 * Order lifecycle. Stock is reserved in the same transaction that creates the order,
 * so an order is born in CREATED with its battery already held.
 */
export const ORDER_STATUSES = [
  'CREATED',
  'ASSIGNED',
  'EN_ROUTE',
  'ON_SITE',
  'INSTALLED',
  'PAID',
  'COMPLETED',
  'CANCELLED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  CREATED: 'ثبت‌شده',
  ASSIGNED: 'تخصیص به تکنسین',
  EN_ROUTE: 'تکنسین در مسیر',
  ON_SITE: 'تکنسین در محل',
  INSTALLED: 'نصب‌شده',
  PAID: 'پرداخت‌شده',
  COMPLETED: 'تکمیل‌شده',
  CANCELLED: 'لغوشده',
};

export const TERMINAL_ORDER_STATUSES: readonly OrderStatus[] = ['COMPLETED', 'CANCELLED'];

export interface OrderTransition {
  from: OrderStatus;
  to: OrderStatus;
  roles: readonly Role[];
}

const OFFICE: readonly Role[] = ['SUPER_ADMIN', 'BRANCH_MANAGER', 'OPERATOR'];
const FIELD: readonly Role[] = ['SUPER_ADMIN', 'BRANCH_MANAGER', 'TECHNICIAN'];

/**
 * Allowed transitions and who may perform them. The API (OrderStateService) is the only
 * enforcer; the UI reads this table just to decide which buttons to show.
 */
export const ORDER_TRANSITIONS: readonly OrderTransition[] = [
  { from: 'CREATED', to: 'ASSIGNED', roles: OFFICE },
  { from: 'ASSIGNED', to: 'ASSIGNED', roles: OFFICE }, // reassign technician
  { from: 'ASSIGNED', to: 'EN_ROUTE', roles: FIELD },
  { from: 'EN_ROUTE', to: 'ON_SITE', roles: FIELD },
  { from: 'ON_SITE', to: 'INSTALLED', roles: FIELD },
  { from: 'INSTALLED', to: 'PAID', roles: [...FIELD, 'OPERATOR'] },
  { from: 'PAID', to: 'COMPLETED', roles: OFFICE },
  { from: 'CREATED', to: 'CANCELLED', roles: OFFICE },
  { from: 'ASSIGNED', to: 'CANCELLED', roles: OFFICE },
  { from: 'EN_ROUTE', to: 'CANCELLED', roles: OFFICE },
  { from: 'ON_SITE', to: 'CANCELLED', roles: OFFICE },
];

export function canTransition(from: OrderStatus, to: OrderStatus, role: Role): boolean {
  return ORDER_TRANSITIONS.some((t) => t.from === from && t.to === to && t.roles.includes(role));
}

export function nextStatuses(from: OrderStatus, role: Role): OrderStatus[] {
  return ORDER_TRANSITIONS.filter((t) => t.from === from && t.roles.includes(role)).map(
    (t) => t.to,
  );
}
