/**
 * Single home for business-rule ASSUMPTIONS (listed in README → «فرضیات»).
 * Change values here, not in services or the UI.
 */
export const BUSINESS_RULES = {
  timezone: 'Asia/Tehran',

  /** Flat on-site installation fee added to every order, Rial (= ۳۵۰٬۰۰۰ تومان). */
  installFeeRial: 3_500_000n,

  /**
   * Share of Battery.coreCreditRial granted per old-battery condition, in percent.
   * When coreReturnExpected = true the order is priced as if an intact core comes back;
   * the API corrects totalRial at INSTALLED from the recorded CoreReturn.
   */
  coreCreditPercent: { INTACT: 100, DAMAGED: 50, NOT_RETURNED: 0 },

  /** Catalogue prices include VAT; no separate tax line in the demo. */
  pricesIncludeVat: true,

  /** Customers book from tomorrow up to N days ahead. */
  bookingMinDaysAhead: 1,
  bookingMaxDaysAhead: 7,

  /** One battery per order in the demo. */
  quantityPerOrder: 1,

  idempotencyKeyMaxLength: 100,
} as const;
