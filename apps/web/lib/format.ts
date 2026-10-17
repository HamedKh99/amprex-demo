import { toPersianDigits } from '@amprex/shared';

/*
 * Display-only formatting. Money arrives from the API as Rial decimal strings; the UI shows
 * Toman (÷10) with Persian digits and «٬» separators. Dates are Jalali via Intl.
 */

const TZ = 'Asia/Tehran';
const CAL = 'fa-IR-u-ca-persian';

const number = new Intl.NumberFormat('fa-IR');

/** 1234 → «۱٬۲۳۴» */
export const faNumber = (n: number | bigint) => number.format(n);
export const faDigits = (s: string | number) => toPersianDigits(String(s));

/** Rial (string | bigint) → Toman number text, e.g. "48500000" → «۴٬۸۵۰٬۰۰۰». */
export function toman(rial: string | bigint | null | undefined): string {
  if (rial === null || rial === undefined || rial === '') return '—';
  return number.format(BigInt(rial) / 10n);
}

/** Toman typed by a person (Persian or Latin digits, separators) → Rial string, or null. */
export function tomanInputToRial(input: string): string | null {
  const digits = input.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[^\d]/g, '');
  return digits ? (BigInt(digits) * 10n).toString() : null;
}

/** Millions with one decimal, e.g. 384_000_000 Rial → «۳۸٫۴» (design: «۳۸٫۴ میلیون تومان»). */
export function tomanMillions(rial: string | bigint): string {
  const tomanValue = Number(BigInt(rial) / 10n) / 1_000_000;
  return new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 }).format(tomanValue);
}

/** "09123456789" → «۰۹۱۲ ۳۴۵ ۶۷۸۹» */
export function faPhone(phone: string): string {
  const p = phone.replace(/\D/g, '');
  return toPersianDigits(p.length === 11 ? `${p.slice(0, 4)} ${p.slice(4, 7)} ${p.slice(7)}` : p);
}

/** Calendar day "YYYY-MM-DD" (Tehran) → a Date inside that day, safe to format in Tehran. */
const dayToDate = (day: string) => new Date(`${day}T12:00:00+03:30`);
const asDate = (v: string | Date) => (v instanceof Date ? v : /^\d{4}-\d{2}-\d{2}$/.test(v) ? dayToDate(v) : new Date(v));

function parts(v: string | Date, opts: Intl.DateTimeFormatOptions) {
  return Object.fromEntries(
    new Intl.DateTimeFormat(CAL, { timeZone: TZ, ...opts }).formatToParts(asDate(v)).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
}

/** «یکشنبه ۲۶ مهر» */
export function weekdayDayMonth(v: string | Date) {
  const p = parts(v, { weekday: 'long', day: 'numeric', month: 'long' });
  return `${p.weekday} ${p.day} ${p.month}`;
}

/** «شنبه ۲۵ مهر ۱۴۰۵» */
export function fullDate(v: string | Date) {
  const p = parts(v, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return `${p.weekday} ${p.day} ${p.month} ${p.year}`;
}

/** «۲۵ مهر ۱۴۰۵» */
export function dayMonthYear(v: string | Date) {
  const p = parts(v, { day: 'numeric', month: 'long', year: 'numeric' });
  return `${p.day} ${p.month} ${p.year}`;
}

/** «۲۵ مهر» */
export function dayMonth(v: string | Date) {
  const p = parts(v, { day: 'numeric', month: 'long' });
  return `${p.day} ${p.month}`;
}

/** Parts for the day picker: «یکشنبه» / «۲۶» / «مهر». */
export function dayPickerParts(v: string | Date) {
  const p = parts(v, { weekday: 'long', day: 'numeric', month: 'long' });
  return { weekday: p.weekday!, day: p.day!, month: p.month! };
}

/** 24-hour «۱۴:۲۰» */
export function time(v: string | Date) {
  const p = parts(v, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return `${p.hour}:${p.minute}`;
}

/** «۲۵ مهر، ۱۱:۳۰» */
export const dayMonthTime = (v: string | Date) => `${dayMonth(v)}، ${time(v)}`;
/** «شنبه ۲۵ مهر، ۱۰:۴۲» */
export const weekdayDayMonthTime = (v: string | Date) => `${weekdayDayMonth(v)}، ${time(v)}`;
/** «شنبه ۲۵ مهر ۱۴۰۵، ۱۰:۴۲» */
export const fullDateTime = (v: string | Date) => `${fullDate(v)}، ${time(v)}`;

/** Slot "14:00"–"17:00" → «۱۴ تا ۱۷» (minutes shown only when not on the hour). */
export function slotRange(start: string, end: string) {
  const h = (t: string) => {
    const [hh, mm] = t.split(':');
    return toPersianDigits(mm === '00' ? String(Number(hh)) : `${Number(hh)}:${mm}`);
  };
  return `${h(start)} تا ${h(end)}`;
}

/** Calendar day (Tehran) as "YYYY-MM-DD". */
export function tehranToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(now);
}

/** Integer typed with Persian or Latin digits → number (NaN-free: empty → null). */
export function parseFaInt(input: string): number | null {
  const digits = input.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[^\d]/g, '');
  return digits ? Number(digits) : null;
}

/** "YYYY-MM-DD" ± days (calendar arithmetic on the date string). */
export function addDaysIso(day: string, days: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
