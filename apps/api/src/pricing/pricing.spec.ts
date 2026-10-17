import { coreCreditFor, quote } from './pricing.js';

const battery = { priceRial: 58_000_000n, coreCreditRial: 10_000_000n };

describe('pricing', () => {
  it('quotes battery + install fee − full core credit when the core will be returned', () => {
    expect(quote(battery, true)).toEqual({
      batteryPriceRial: 58_000_000n,
      installFeeRial: 3_500_000n,
      coreCreditRial: 10_000_000n,
      totalRial: 51_500_000n,
    });
  });

  it('gives no credit when the customer keeps the old battery', () => {
    expect(quote(battery, false).totalRial).toBe(61_500_000n);
  });

  it('scales the credit by the returned core condition', () => {
    expect(coreCreditFor(battery, 'INTACT')).toBe(10_000_000n);
    expect(coreCreditFor(battery, 'DAMAGED')).toBe(5_000_000n);
    expect(coreCreditFor(battery, 'NOT_RETURNED')).toBe(0n);
  });
});
