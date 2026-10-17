import { randomInt } from 'node:crypto';
import { BUSINESS_RULES } from '../config/business-rules.js';

const jalali = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', {
  timeZone: BUSINESS_RULES.timezone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// No 0/O or 1/I so codes survive being read out over the phone.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** <PREFIX>-<Jalali YYMMDD>-<4 chars>; used for orders (AMX), receipts (RCV) and transfers (TRF). */
export function documentCode(prefix: string, at: Date, pick: (max: number) => number = randomInt): string {
  const parts = Object.fromEntries(jalali.formatToParts(at).map((p) => [p.type, p.value]));
  const suffix = Array.from({ length: 4 }, () => ALPHABET[pick(ALPHABET.length)]).join('');
  return `${prefix}-${parts.year!.slice(-2)}${parts.month}${parts.day}-${suffix}`;
}

/** Customer-facing tracking code, e.g. AMX-050725-K7Q2. */
export const orderCode = (at: Date, pick?: (max: number) => number) => documentCode('AMX', at, pick);

export const ORDER_CODE_PATTERN = /^AMX-(\d{6}-[A-Z2-9]{4}|LEGACY-\d+)$/;
