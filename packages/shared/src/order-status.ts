import type { Role } from './roles.js';

/**
 * Order lifecycle. Stock is reserved in the same transaction that creates the order, so an
 * order is born in CREATED with its battery held. «ثبت پایان و تسویه» (INSTALLING → COMPLETED)
 * issues the battery, records the old battery and the payment in one step.
 */
export const ORDER_STATUSES = [
  'CREATED',
  'ASSIGNED',
  'ACCEPTED',
  'EN_ROUTE',
  'ON_SITE',
  'INSTALLING',
  'COMPLETED',
  'CANCELLED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Office / admin wording (design: admin badges). */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  CREATED: 'در انتظار تخصیص',
  ASSIGNED: 'تخصیص‌یافته',
  ACCEPTED: 'پذیرفته‌شده',
  EN_ROUTE: 'در مسیر',
  ON_SITE: 'در محل',
  INSTALLING: 'در حال نصب',
  COMPLETED: 'تکمیل‌شده',
  CANCELLED: 'لغوشده',
};

/** Technician app wording (design: tech mission cards). */
export const TECH_STATUS_LABELS: Record<OrderStatus, string> = {
  ...ORDER_STATUS_LABELS,
  ASSIGNED: 'منتظر پذیرش',
};

export const TERMINAL_ORDER_STATUSES: readonly OrderStatus[] = ['COMPLETED', 'CANCELLED'];
/** A technician is assigned and the job is not finished. */
export const ACTIVE_MISSION_STATUSES: readonly OrderStatus[] = [
  'ASSIGNED',
  'ACCEPTED',
  'EN_ROUTE',
  'ON_SITE',
  'INSTALLING',
];

export interface OrderTransition {
  from: OrderStatus;
  to: OrderStatus;
  roles: readonly Role[];
}

const OFFICE: readonly Role[] = ['SUPER_ADMIN', 'BRANCH_MANAGER', 'OPERATOR'];
const FIELD: readonly Role[] = ['SUPER_ADMIN', 'BRANCH_MANAGER', 'TECHNICIAN'];

/**
 * Allowed transitions and who may perform them. The API (OrderStateService) is the only
 * enforcer; the UI reads `allowedTransitions` from API responses to decide which buttons to show.
 */
export const ORDER_TRANSITIONS: readonly OrderTransition[] = [
  { from: 'CREATED', to: 'ASSIGNED', roles: OFFICE },
  { from: 'ASSIGNED', to: 'ASSIGNED', roles: OFFICE }, // reassign before acceptance
  { from: 'ACCEPTED', to: 'ASSIGNED', roles: OFFICE }, // reassign after acceptance
  { from: 'ASSIGNED', to: 'ACCEPTED', roles: FIELD },
  { from: 'ACCEPTED', to: 'EN_ROUTE', roles: FIELD },
  { from: 'EN_ROUTE', to: 'ON_SITE', roles: FIELD },
  { from: 'ON_SITE', to: 'INSTALLING', roles: FIELD },
  { from: 'INSTALLING', to: 'COMPLETED', roles: FIELD },
  { from: 'CREATED', to: 'CANCELLED', roles: OFFICE },
  { from: 'ASSIGNED', to: 'CANCELLED', roles: OFFICE },
  { from: 'ACCEPTED', to: 'CANCELLED', roles: OFFICE },
  { from: 'EN_ROUTE', to: 'CANCELLED', roles: OFFICE },
  { from: 'ON_SITE', to: 'CANCELLED', roles: OFFICE },
  { from: 'INSTALLING', to: 'CANCELLED', roles: OFFICE },
];

export function canTransition(from: OrderStatus, to: OrderStatus, role: Role): boolean {
  return ORDER_TRANSITIONS.some((t) => t.from === from && t.to === to && t.roles.includes(role));
}

export function nextStatuses(from: OrderStatus, role: Role): OrderStatus[] {
  return ORDER_TRANSITIONS.filter((t) => t.from === from && t.roles.includes(role)).map(
    (t) => t.to,
  );
}

/** Customer-facing milestones on the tracking page (design: «مراحل سفارش»). */
export const TRACKING_MILESTONES = [
  'PLACED',
  'RESERVED',
  'ASSIGNED',
  'EN_ROUTE',
  'INSTALLING',
  'SETTLED',
] as const;
export type TrackingMilestone = (typeof TRACKING_MILESTONES)[number];
export const TRACKING_MILESTONE_LABELS: Record<TrackingMilestone, string> = {
  PLACED: 'ثبت سفارش',
  RESERVED: 'تأیید و رزرو باتری',
  ASSIGNED: 'تخصیص تکنسین',
  EN_ROUTE: 'تکنسین در مسیر',
  INSTALLING: 'نصب و تست باتری',
  SETTLED: 'پرداخت و تحویل باتری کهنه',
};
