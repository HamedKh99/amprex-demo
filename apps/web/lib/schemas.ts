import { toLatinDigits } from '@amprex/shared';
import { z } from 'zod';

/** Iranian mobile; Persian/Arabic digits and spaces are accepted and normalised. */
export const mobile = z
  .string()
  .transform((v) => toLatinDigits(v).replace(/\s|-/g, ''))
  .pipe(z.string().regex(/^09\d{9}$/, 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.'));

export const loginSchema = z.object({
  phone: mobile,
  password: z.string().min(4, 'رمز عبور را وارد کنید.'),
  remember: z.boolean(),
});
export type LoginInput = z.input<typeof loginSchema>;
export type LoginValues = z.output<typeof loginSchema>;
