/** Shape of every API error body. */
export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'OUT_OF_STOCK',
  'INCOMPATIBLE_BATTERY',
  'IDEMPOTENCY_KEY_REQUIRED',
  'INVALID_TRANSITION',
  'SLOT_FULL',
  'DISTRICT_NOT_COVERED',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];
