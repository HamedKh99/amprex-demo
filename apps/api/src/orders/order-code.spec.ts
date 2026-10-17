import { ORDER_CODE_PATTERN, orderCode } from './order-code.js';

describe('orderCode', () => {
  it('uses the Jalali date in Tehran and four unambiguous characters', () => {
    // 2026-10-17 is ۲۵ مهر ۱۴۰۵.
    const code = orderCode(new Date('2026-10-17T08:00:00Z'), () => 0);
    expect(code).toBe('AMX-050725-AAAA');
    expect(ORDER_CODE_PATTERN.test(orderCode(new Date()))).toBe(true);
  });

  it('switches day at Tehran midnight', () => {
    expect(orderCode(new Date('2026-10-17T20:31:00Z'), () => 0)).toBe('AMX-050726-AAAA');
  });
});
