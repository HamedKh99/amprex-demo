import { coreCredit, finalPriceExamples, grossProfit, quote } from './pricing.js';

// Numbers from the design handoff (Toman × 10 = Rial): صبا باتری ۶۰ آمپر, ۴٬۸۵۰٬۰۰۰ تومان.
const saba60 = { priceRial: 48_500_000n, capacityAh: 60 };

describe('pricing', () => {
  it('estimates with an old battery of the same Ah and free installation', () => {
    expect(quote(saba60)).toEqual({
      batteryPriceRial: 48_500_000n,
      installFeeRial: 0n,
      coreCreditRial: 9_000_000n, // ۶۰ × ۱۵٬۰۰۰ تومان
      totalRial: 39_500_000n, // ۳٬۹۵۰٬۰۰۰ تومان
      estimatedCoreAh: 60,
    });
  });

  it('gives no credit without an old battery', () => {
    expect(quote(saba60, false).totalRial).toBe(48_500_000n);
  });

  it('credits 15,000 Toman per Ah of the returned battery', () => {
    expect(coreCredit(45)).toBe(6_750_000n);
    expect(coreCredit(null)).toBe(0n);
  });

  it('produces the review-step table: 70 / 60 (estimate) / 45 / none', () => {
    expect(finalPriceExamples(saba60)).toEqual([
      { oldAh: 70, isEstimate: false, totalRial: 38_000_000n },
      { oldAh: 60, isEstimate: true, totalRial: 39_500_000n },
      { oldAh: 45, isEstimate: false, totalRial: 41_750_000n },
      { oldAh: null, isEstimate: false, totalRial: 48_500_000n },
    ]);
  });

  it('estimates gross profit as payable − cost + scrap value', () => {
    // ۳٬۹۵۰٬۰۰۰ − ۳٬۵۵۰٬۰۰۰ + ۴۵۰٬۰۰۰ = ۸۵۰٬۰۰۰ تومان
    expect(grossProfit(39_500_000n, 35_500_000n, 60)).toBe(8_500_000n);
  });
});
