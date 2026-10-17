/**
 * Single home for business-rule ASSUMPTIONS (listed in README → «فرضیات»).
 * Change values here, not in services or the UI. Money is Rial (BigInt).
 */
export const BUSINESS_RULES = {
  timezone: 'Asia/Tehran',

  /** On-site installation is free (design: «نصب در محل رایگان»). Kept as a column for later. */
  installFeeRial: 0n,

  /**
   * Old-battery (باتری داغی) credit per ampere-hour of the returned battery
   * (design: «هر آمپر ۱۵٬۰۰۰ تومان»). At order time the old battery is assumed to have
   * the same Ah as the new one; the technician records the real Ah at «ثبت پایان».
   */
  coreCreditPerAhRial: 150_000n,
  /** Accepted Ah range for the old battery (design: «عدد بین ۲۰ تا ۲۰۰ وارد کنید.»). */
  coreAhMin: 20,
  coreAhMax: 200,
  /** Rows of the «مبلغ نهایی» example table, as Ah offsets from the new battery; null = no core. */
  coreExampleOffsetsAh: [10, 0, -15, null] as const,

  /** Scrap value the company recovers per Ah of returned old battery (gross-profit estimate). */
  coreScrapValuePerAhRial: 75_000n,

  /** Catalogue prices include VAT; no separate tax line in the demo. */
  pricesIncludeVat: true,

  /** Bookable days: today through +6 (seven days). Today's slots close this long before start. */
  bookingDays: 7,
  sameDayLeadMinutes: 60,

  /** One battery per order in the demo. */
  quantityPerOrder: 1,

  idempotencyKeyMaxLength: 100,

  /** A technician at or above this share of daily capacity is «پربار». */
  technicianBusyRatio: 0.8,

  /** Dashboard alerts. */
  alerts: {
    /** Unassigned orders whose slot starts within this many minutes. */
    unassignedWithinMinutes: 180,
    /** Not on site this many minutes after the slot started. */
    lateArrivalMinutes: 30,
    /** Free stock at or below this is «موجودی کم». */
    lowStockAvailable: 5,
    /** Settlement mismatches from the last N days. */
    discrepancyDays: 7,
  },

  /** Shown in the site footer and empty states. */
  supportPhone: '02166001200',
} as const;
