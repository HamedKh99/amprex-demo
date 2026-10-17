import { Transform } from 'class-transformer';
import { toLatinDigits } from '@amprex/shared';

/** Trims strings and converts Persian/Arabic digits to ASCII before validation. */
export const NormalizeText = () =>
  Transform(({ value }) => (typeof value === 'string' ? toLatinDigits(value).trim() : value));

/** Query-string booleans: "true"/"false" → boolean. */
export const ToBoolean = () =>
  Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value));

export const IRAN_MOBILE = /^09\d{9}$/;
export const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
