export const PAYMENT_METHODS = ['CASH', 'CARD_POS', 'CARD_TO_CARD', 'ONLINE'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'نقدی',
  CARD_POS: 'کارت‌خوان',
  CARD_TO_CARD: 'کارت‌به‌کارت',
  ONLINE: 'درگاه اینترنتی',
};
/** Methods a technician can take on site (design: finish form). */
export const ON_SITE_PAYMENT_METHODS: readonly PaymentMethod[] = ['CASH', 'CARD_POS', 'CARD_TO_CARD'];

export const PAYMENT_STATUSES = ['PENDING', 'PAID', 'FAILED', 'REFUNDED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: 'در انتظار پرداخت',
  PAID: 'پرداخت‌شده',
  FAILED: 'ناموفق',
  REFUNDED: 'بازگشت وجه',
};

export const VEHICLE_TYPES = ['CAR', 'MOTORCYCLE'] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];
export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  CAR: 'خودرو',
  MOTORCYCLE: 'موتورسیکلت',
};

export const INSTALL_LOCATIONS = ['PARKING', 'STREET', 'WORKPLACE'] as const;
export type InstallLocation = (typeof INSTALL_LOCATIONS)[number];
export const INSTALL_LOCATION_LABELS: Record<InstallLocation, string> = {
  PARKING: 'پارکینگ',
  STREET: 'کنار خیابان',
  WORKPLACE: 'محل کار',
};

export const STOCK_MOVEMENT_TYPES = ['RECEIPT', 'RESERVE', 'RELEASE', 'ISSUE', 'ADJUST'] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];
export const STOCK_MOVEMENT_LABELS: Record<StockMovementType, string> = {
  RECEIPT: 'ورود به انبار',
  RESERVE: 'رزرو برای سفارش',
  RELEASE: 'آزادسازی رزرو',
  ISSUE: 'خروج برای نصب',
  ADJUST: 'اصلاح موجودی',
};

/** Technician availability for one order (design: assignment sheet badges). */
export const TECHNICIAN_FIT = ['RECOMMENDED', 'FREE', 'BUSY', 'FULL'] as const;
export type TechnicianFit = (typeof TECHNICIAN_FIT)[number];
export const TECHNICIAN_FIT_LABELS: Record<TechnicianFit, string> = {
  RECOMMENDED: 'پیشنهاد سیستم',
  FREE: 'آزاد',
  BUSY: 'پربار',
  FULL: 'ظرفیت تکمیل',
};
