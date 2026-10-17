import type { CoreCondition } from '@amprex/shared';
import { BUSINESS_RULES } from '../config/business-rules.js';

export interface PricedBattery {
  priceRial: bigint;
  coreCreditRial: bigint;
}

export interface PriceBreakdown {
  batteryPriceRial: bigint;
  installFeeRial: bigint;
  coreCreditRial: bigint;
  totalRial: bigint;
}

/** Credit actually granted for a returned old battery in the given condition. */
export function coreCreditFor(battery: PricedBattery, condition: CoreCondition): bigint {
  return (battery.coreCreditRial * BigInt(BUSINESS_RULES.coreCreditPercent[condition])) / 100n;
}

/** Price at order time; assumes an intact core when the customer says they will return it. */
export function quote(battery: PricedBattery, coreReturnExpected: boolean): PriceBreakdown {
  return breakdown(
    battery.priceRial,
    BUSINESS_RULES.installFeeRial,
    coreReturnExpected ? coreCreditFor(battery, 'INTACT') : 0n,
  );
}

export function breakdown(
  batteryPriceRial: bigint,
  installFeeRial: bigint,
  coreCreditRial: bigint,
): PriceBreakdown {
  return {
    batteryPriceRial,
    installFeeRial,
    coreCreditRial,
    totalRial: batteryPriceRial + installFeeRial - coreCreditRial,
  };
}
