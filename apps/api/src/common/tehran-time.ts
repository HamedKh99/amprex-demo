import { BUSINESS_RULES } from '../config/business-rules.js';

const ymd = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_RULES.timezone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Iran has had a fixed UTC+03:30 offset since DST was abolished in 2022. */
const TEHRAN_OFFSET_MS = 3.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** "YYYY-MM-DD" calendar date in Tehran for an instant. */
export function tehranDate(at: Date | number = Date.now()): string {
  return ymd.format(at);
}

export function addDays(date: string, days: number): string {
  return formatDateOnly(new Date(dateOnly(date).getTime() + days * DAY_MS));
}

/** "YYYY-MM-DD" → Date at UTC midnight, the form Prisma uses for @db.Date. */
export function dateOnly(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

/** @db.Date value → "YYYY-MM-DD". */
export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Instant at which the given Tehran calendar day starts. */
export function tehranDayStart(date: string): Date {
  return new Date(dateOnly(date).getTime() - TEHRAN_OFFSET_MS);
}

/** Bookable dates (Tehran): today and the following days, «bookingDays» in total. */
export function bookingWindow(now: Date | number = Date.now()): string[] {
  const today = tehranDate(now);
  return Array.from({ length: BUSINESS_RULES.bookingDays }, (_, d) => addDays(today, d));
}

/** Instant of "HH:mm" Tehran time on a Tehran calendar day. */
export function tehranTime(date: string, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(tehranDayStart(date).getTime() + (h! * 60 + m!) * 60_000);
}
