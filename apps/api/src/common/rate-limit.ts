import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';

/*
 * In-memory, fixed-window rate limiting per client IP and route. Replaces @nestjs/throttler, whose
 * CommonJS build require()s the ESM-only Nest 12 packages, which Vercel's Node runtime rejects
 * (ERR_REQUIRE_ESM). Counters live in one process: on Vercel each Function instance counts on its
 * own and starts empty after a cold start, which is acceptable for the demo.
 */

export interface RateLimitOptions {
  limit: number;
  ttlMs: number;
}

export const DEFAULT_RATE_LIMIT: RateLimitOptions = { limit: 120, ttlMs: 60_000 };
const RATE_LIMIT_KEY = 'amprex:rate-limit';

/** Overrides the default limit for one route or controller. */
export const RateLimit = (limit: number, ttlMs = 60_000) =>
  SetMetadata(RATE_LIMIT_KEY, { limit, ttlMs } satisfies RateLimitOptions);

interface Window {
  count: number;
  resetAt: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly windows = new Map<string, Window>();
  private nextSweep = 0;

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;
    const { limit, ttlMs } =
      this.reflector.getAllAndOverride<RateLimitOptions>(RATE_LIMIT_KEY, [context.getHandler(), context.getClass()]) ??
      DEFAULT_RATE_LIMIT;
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const now = Date.now();
    this.sweep(now);

    // req.ip is the real client because app.setup.ts trusts X-Forwarded-For.
    const key = `${req.ip}|${context.getClass().name}.${context.getHandler().name}`;
    let w = this.windows.get(key);
    if (!w || w.resetAt <= now) {
      w = { count: 0, resetAt: now + ttlMs };
      this.windows.set(key, w);
    }
    w.count++;

    const resetSeconds = Math.ceil((w.resetAt - now) / 1000);
    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - w.count));
    res.setHeader('X-RateLimit-Reset', resetSeconds);
    if (w.count > limit) {
      res.setHeader('Retry-After', resetSeconds);
      // HttpExceptionFilter turns a bare 429 into { code: 'RATE_LIMITED', message(fa) }.
      throw new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }

  /** Drops expired windows at most once a minute so the map cannot grow without bound. */
  private sweep(now: number) {
    if (now < this.nextSweep) return;
    this.nextSweep = now + 60_000;
    for (const [key, w] of this.windows) if (w.resetAt <= now) this.windows.delete(key);
  }
}
