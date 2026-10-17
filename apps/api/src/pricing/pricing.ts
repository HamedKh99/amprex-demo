import { BUSINESS_RULES } from '../config/business-rules.js';

export interface PriceBreakdown {
  batteryPriceRial: bigint;
  installFeeRial: bigint;
  coreCreditRial: bigint;
  totalRial: bigint;
}

/** Credit for returning an old battery of `ah` ampere-hours; null = no old battery. */
export function coreCredit(ah: number | null): bigint {
  return ah ? BigInt(ah) * BUSINESS_RULES.coreCreditPerAhRial : 0n;
}

/** What the company recovers from a returned old battery (gross-profit estimate). */
export function coreScrapValue(ah: number | null): bigint {
  return ah ? BigInt(ah) * BUSINESS_RULES.coreScrapValuePerAhRial : 0n;
}

export function breakdown(batteryPriceRial: bigint, installFeeRial: bigint, coreAh: number | null): PriceBreakdown {
  const coreCreditRial = coreCredit(coreAh);
  const gross = batteryPriceRial + installFeeRial;
  // Credit never makes the payable negative.
  const credit = coreCreditRial > gross ? gross : coreCreditRial;
  return { batteryPriceRial, installFeeRial, coreCreditRial: credit, totalRial: gross - credit };
}

/**
 * Price at order time. The old battery is assumed to have the new battery's Ah
 * (design: «برآورد ۶۰ آمپر»), unless the customer has none.
 */
export function quote(battery: { priceRial: bigint; capacityAh: number }, withCore = true) {
  const estimatedCoreAh = withCore ? battery.capacityAh : null;
  return {
    ...breakdown(battery.priceRial, BUSINESS_RULES.installFeeRial, estimatedCoreAh),
    estimatedCoreAh,
  };
}

/** Rows of the review-step table «باتری کهنه شما / مبلغ نهایی». */
export function finalPriceExamples(battery: { priceRial: bigint; capacityAh: number }) {
  return BUSINESS_RULES.coreExampleOffsetsAh.map((offset) => {
    const oldAh = offset === null ? null : battery.capacityAh + offset;
    return {
      oldAh,
      isEstimate: offset === 0,
      totalRial: breakdown(battery.priceRial, BUSINESS_RULES.installFeeRial, oldAh).totalRial,
    };
  });
}

/** Gross profit = payable − battery cost + scrap value of the old battery. */
export function grossProfit(totalRial: bigint, batteryCostRial: bigint, coreAh: number | null): bigint {
  return totalRial - batteryCostRial + coreScrapValue(coreAh);
}
