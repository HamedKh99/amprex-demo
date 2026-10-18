import { HttpException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimit, RateLimitGuard } from './rate-limit.js';

class Login {
  @RateLimit(3)
  login() {}

  other() {}
}

function call(guard: RateLimitGuard, handler: 'login' | 'other', ip: string) {
  const headers: Record<string, unknown> = {};
  const ctx = {
    getType: () => 'http',
    getClass: () => Login,
    getHandler: () => Login.prototype[handler],
    switchToHttp: () => ({
      getRequest: () => ({ ip }),
      getResponse: () => ({ setHeader: (k: string, v: unknown) => (headers[k] = v) }),
    }),
  } as unknown as ExecutionContext;
  try {
    return { ok: guard.canActivate(ctx), headers };
  } catch (e) {
    return { ok: false, status: (e as HttpException).getStatus(), headers };
  }
}

describe('RateLimitGuard', () => {
  afterEach(() => vi.useRealTimers());

  it('blocks a client after the route limit with 429 and Retry-After', () => {
    const guard = new RateLimitGuard(new Reflector());
    for (let i = 0; i < 3; i++) expect(call(guard, 'login', '1.1.1.1').ok).toBe(true);
    const blocked = call(guard, 'login', '1.1.1.1');
    expect(blocked).toMatchObject({ ok: false, status: 429 });
    expect(blocked.headers['X-RateLimit-Remaining']).toBe(0);
    expect(blocked.headers['Retry-After']).toBe(60);
  });

  it('counts each client IP and each route separately', () => {
    const guard = new RateLimitGuard(new Reflector());
    for (let i = 0; i < 3; i++) call(guard, 'login', '1.1.1.1');
    expect(call(guard, 'login', '2.2.2.2').ok).toBe(true);
    expect(call(guard, 'other', '1.1.1.1').ok).toBe(true);
  });

  it('uses the default of 120 per minute without @RateLimit', () => {
    const guard = new RateLimitGuard(new Reflector());
    expect(call(guard, 'other', '1.1.1.1').headers['X-RateLimit-Limit']).toBe(120);
  });

  it('opens a new window once the old one expires', () => {
    vi.useFakeTimers();
    const guard = new RateLimitGuard(new Reflector());
    for (let i = 0; i < 4; i++) call(guard, 'login', '1.1.1.1');
    vi.advanceTimersByTime(60_000);
    expect(call(guard, 'login', '1.1.1.1').ok).toBe(true);
  });
});
