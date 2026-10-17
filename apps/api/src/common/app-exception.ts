import { HttpException, HttpStatus } from '@nestjs/common';
import type { ApiError, ErrorCode } from '@amprex/shared';

/** Throw from services; HttpExceptionFilter renders it as { code, message, details? }. */
export class AppException extends HttpException {
  constructor(status: HttpStatus, code: ErrorCode, message: string, details?: unknown) {
    const body: ApiError = details === undefined ? { code, message } : { code, message, details };
    super(body, status);
  }
}

/** `what` is a Persian noun, e.g. «سفارش». */
export function notFound(what: string) {
  return new AppException(HttpStatus.NOT_FOUND, 'NOT_FOUND', `${what} یافت نشد.`);
}

export function forbidden(message = 'شما به این بخش دسترسی ندارید.') {
  return new AppException(HttpStatus.FORBIDDEN, 'FORBIDDEN', message);
}
