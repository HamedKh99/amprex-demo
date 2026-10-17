import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import type { ApiError, ErrorCode } from '@amprex/shared';

const DEFAULT_BY_STATUS: Partial<Record<number, { code: ErrorCode; message: string }>> = {
  400: { code: 'VALIDATION_ERROR', message: 'اطلاعات ارسال‌شده معتبر نیست.' },
  401: { code: 'UNAUTHORIZED', message: 'لطفاً ابتدا وارد شوید.' },
  403: { code: 'FORBIDDEN', message: 'شما به این بخش دسترسی ندارید.' },
  404: { code: 'NOT_FOUND', message: 'مورد درخواستی یافت نشد.' },
  429: { code: 'RATE_LIMITED', message: 'تعداد درخواست‌ها بیش از حد مجاز است. کمی بعد تلاش کنید.' },
};
const INTERNAL: ApiError = { code: 'INTERNAL_ERROR', message: 'خطای داخلی سرور رخ داد.' };

/** Renders every error as { code, message(fa), details? }. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (!(exception instanceof HttpException)) {
      this.logger.error(exception);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(INTERNAL);
      return;
    }

    const status = exception.getStatus();
    const raw = exception.getResponse() as string | Record<string, unknown>;
    if (typeof raw === 'object' && 'code' in raw && 'message' in raw) {
      res.status(status).json(raw); // already an AppException body
      return;
    }

    const fallback = DEFAULT_BY_STATUS[status] ?? INTERNAL;
    // ValidationPipe puts the per-field messages in `message: string[]`.
    const details = typeof raw === 'object' && Array.isArray(raw.message) ? raw.message : undefined;
    const body: ApiError = details ? { ...fallback, details } : fallback;
    res.status(status).json(body);
  }
}
