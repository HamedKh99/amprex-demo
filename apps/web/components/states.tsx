'use client';

import { RotateCw, SearchX, WifiOff } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ApiRequestError } from '@/lib/api';
import { faDigits } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Design «خالی»: icon in a muted circle, title, hint, optional actions. */
export function EmptyState({
  icon: Icon = SearchX,
  title,
  description,
  children,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center gap-3 px-6 py-12 text-center', className)}>
      <span className="flex size-14 items-center justify-center rounded-full bg-muted text-slate-600">
        <Icon className="size-6" aria-hidden />
      </span>
      <h3 className="m-0 text-base font-bold">{title}</h3>
      {description && <p className="m-0 max-w-sm text-sm leading-7 text-muted-foreground">{description}</p>}
      {children && <div className="mt-1 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

/**
 * Design «خطا — بارگذاری ناموفق»: the server's Persian message when there is one,
 * a retry button, and the error id for support.
 */
export function ErrorState({
  error,
  title,
  description,
  onRetry,
  retrying,
  className,
}: {
  error: unknown;
  title: string;
  description?: string;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}) {
  const e = error instanceof ApiRequestError ? error : null;
  const network = !e || e.status === 0 || e.status >= 500;
  return (
    <div role="alert" className={cn('flex flex-col items-center gap-3 px-6 py-12 text-center', className)}>
      <span className="flex size-14 items-center justify-center rounded-full bg-destructive-muted text-destructive">
        <WifiOff className="size-6" aria-hidden />
      </span>
      <h3 className="m-0 text-base font-bold">{title}</h3>
      <p className="m-0 max-w-sm text-sm leading-7 text-muted-foreground">
        {network ? (description ?? 'ارتباط با سرور برقرار نشد.') : e!.message}
      </p>
      {onRetry && (
        <Button variant="primary" onClick={onRetry} disabled={retrying}>
          <RotateCw aria-hidden className={cn(retrying && 'animate-spin')} />
          تلاش دوباره
        </Button>
      )}
      {e && (
        <p className="m-0 text-xs text-subtle-foreground">
          شناسه خطا: {faDigits(e.status || 0)}
          {e.requestId && (
            <>
              {' · '}
              <span className="ltr-code">{e.requestId}</span>
            </>
          )}
        </p>
      )}
    </div>
  );
}
