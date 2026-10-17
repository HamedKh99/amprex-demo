import { HttpException, HttpStatus } from '@nestjs/common';
import type { ApiError, ErrorCode } from '@amprex/shared';

/** Throw from services; HttpExceptionFilter renders it as { code, message, details? }. */
export class AppException extends HttpException {
  constructor(status: HttpStatus, code: ErrorCode, message: string, details?: unknown) {
    const body: ApiError = details === undefined ? { code, message } : { code, message, details };
    super(body, status);
  }
}
