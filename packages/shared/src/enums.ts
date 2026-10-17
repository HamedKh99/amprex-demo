export const PAYMENT_METHODS = ['CASH', 'CARD_POS', 'CARD_TO_CARD', 'ONLINE'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'نقدی',
  CARD_POS: 'کارت‌خوان',
  CARD_TO_CARD: 'کارت‌به‌کارت',
  ONLINE: 'درگاه اینترنتی',
};

export const PAYMENT_STATUSES = ['PENDING', 'PAID', 'FAILED', 'REFUNDED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: 'در انتظار پرداخت',
  PAID: 'پرداخت‌شده',
  FAILED: 'ناموفق',
  REFUNDED: 'بازگشت وجه',
};

/** Condition of the returned old battery (باتری داغی). */
export const CORE_CONDITIONS = ['INTACT', 'DAMAGED', 'NOT_RETURNED'] as const;
export type CoreCondition = (typeof CORE_CONDITIONS)[number];
export const CORE_CONDITION_LABELS: Record<CoreCondition, string> = {
  INTACT: 'سالم',
  DAMAGED: 'آسیب‌دیده',
  NOT_RETURNED: 'تحویل داده نشد',
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
