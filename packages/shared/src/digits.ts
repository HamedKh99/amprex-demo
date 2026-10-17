const PERSIAN = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC = '٠١٢٣٤٥٦٧٨٩';

/** Converts Persian/Arabic-Indic digits to ASCII so input like «۰۹۱۲…» validates. */
export function toLatinDigits(input: string): string {
  return input.replace(/[۰-۹٠-٩]/g, (d) => String(PERSIAN.indexOf(d) >= 0 ? PERSIAN.indexOf(d) : ARABIC.indexOf(d)));
}

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

/** ASCII digits → Persian digits (display and matching stored Persian names). */
export function toPersianDigits(input: string | number): string {
  return String(input).replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)]!);
}
