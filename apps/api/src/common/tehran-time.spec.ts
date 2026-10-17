import { addDays, bookingWindow, tehranDate, tehranDayStart, tehranTime } from './tehran-time.js';

describe('tehran-time', () => {
  it('uses the Tehran calendar day, not UTC', () => {
    // 2026-10-17 21:00 UTC is 00:30 on the 18th in Tehran.
    expect(tehranDate(Date.parse('2026-10-17T21:00:00Z'))).toBe('2026-10-18');
    expect(tehranDate(Date.parse('2026-10-17T20:00:00Z'))).toBe('2026-10-17');
  });

  it('adds days across month ends', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('starts a Tehran day at 20:30 UTC of the previous day', () => {
    expect(tehranDayStart('2026-10-18').toISOString()).toBe('2026-10-17T20:30:00.000Z');
  });

  it('offers today and the next six days', () => {
    const w = bookingWindow(Date.parse('2026-10-17T08:00:00Z'));
    expect(w[0]).toBe('2026-10-17');
    expect(w.at(-1)).toBe('2026-10-23');
    expect(w).toHaveLength(7);
  });

  it('resolves a slot start in Tehran time', () => {
    expect(tehranTime('2026-10-18', '14:00').toISOString()).toBe('2026-10-18T10:30:00.000Z');
  });
});
