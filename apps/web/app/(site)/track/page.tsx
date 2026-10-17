'use client';

import { TRACKING_MILESTONE_LABELS, type TrackingMilestone } from '@amprex/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Phone, SearchX } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { LAST_ORDER_KEY } from '@/components/order/step-review';
import { FlowHeader } from '@/components/site/site-chrome';
import { EmptyState, ErrorState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiRequestError } from '@/lib/api';
import { faDigits, faNumber, slotRange, time, weekdayDayMonth, weekdayDayMonthTime } from '@/lib/format';
import { useTrack } from '@/lib/queries';
import { mobile } from '@/lib/schemas';
import type { OrderDetail, Tracking } from '@/lib/types';
import { cn } from '@/lib/utils';

const schema = z.object({
  code: z.string().trim().toUpperCase().min(6, 'کد پیگیری را وارد کنید.'),
  phone: mobile,
});

export default function TrackPage() {
  return (
    <Suspense>
      <Track />
    </Suspense>
  );
}

function Track() {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  // Only the code goes in the URL; the phone stays in memory.
  const [query, setQuery] = useState<{ code: string; phone: string } | null>(null);
  const result = useTrack(query?.code ?? '', query?.phone ?? '', !!query);
  const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { code: params.get('code') ?? '', phone: '' },
  });
  const { errors } = form.formState;
  const submit = form.handleSubmit((v) => {
    setQuery(v);
    router.replace(`${path}?code=${encodeURIComponent(v.code)}`);
  });

  // Coming from «سفارش شما ثبت شد»: fill the phone of the order just placed and look it up.
  useEffect(() => {
    const code = params.get('code');
    if (!code || query) return;
    try {
      const o = JSON.parse(sessionStorage.getItem(LAST_ORDER_KEY) ?? 'null') as OrderDetail | null;
      if (o?.code === code) {
        form.setValue('phone', faDigits(o.customer.phone));
        setQuery({ code, phone: o.customer.phone });
      }
    } catch {
      /* the customer types it */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const notFound = result.error instanceof ApiRequestError && result.error.status === 404;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col bg-background">
      <FlowHeader title="پیگیری سفارش" />
      <main className="flex flex-col gap-4 p-4">
        <form onSubmit={submit} noValidate className="flex flex-col gap-4 rounded-card border border-border bg-card p-4">
          <div>
            <label htmlFor="code" className="mb-2 block text-sm font-semibold">
              کد پیگیری
            </label>
            <Input id="code" dir="ltr" autoComplete="off" aria-invalid={!!errors.code} className="font-mono" {...form.register('code')} />
            {errors.code && <p className="mt-1.5 mb-0 text-xs text-destructive">{errors.code.message}</p>}
          </div>
          <div>
            <label htmlFor="mob" className="mb-2 block text-sm font-semibold">
              شماره موبایل ثبت‌شده
            </label>
            <Input id="mob" dir="ltr" inputMode="numeric" autoComplete="tel" aria-invalid={!!errors.phone} className="text-right" {...form.register('phone')} />
            {errors.phone && <p className="mt-1.5 mb-0 text-xs text-destructive">{errors.phone.message}</p>}
          </div>
          <Button type="submit" variant="primary" size="lg" disabled={result.isFetching}>
            مشاهده وضعیت
          </Button>
        </form>

        {result.isFetching && !result.data && (
          <div role="status" aria-label="در حال بارگذاری وضعیت سفارش" className="flex flex-col gap-3">
            <Skeleton className="h-28 rounded-card" />
            <Skeleton className="h-64 rounded-card" />
          </div>
        )}
        {notFound && <EmptyState icon={SearchX} title="سفارشی با این مشخصات یافت نشد" description="کد پیگیری و شماره موبایل را بررسی کنید." />}
        {result.isError && !notFound && <ErrorState error={result.error} title="دریافت وضعیت سفارش ناموفق بود" onRetry={() => result.refetch()} />}
        {result.data && <TrackingView t={result.data} />}
      </main>
    </div>
  );
}

function TrackingView({ t }: { t: Tracking }) {
  const current = [...t.milestones].reverse().find((m) => m.state !== 'TODO');
  const headline = t.status === 'CANCELLED' ? 'لغوشده' : current ? TRACKING_MILESTONE_LABELS[current.key] : '';
  const meta = (key: TrackingMilestone, at: string | null, state: string) => {
    if (state === 'TODO') return 'در انتظار';
    if (!at) return state === 'NOW' ? 'در انتظار' : '';
    if (key === 'RESERVED') return `${weekdayDayMonthTime(at)} · انبار ${t.branch.name}`;
    if (key === 'ASSIGNED' && t.technician) return `${weekdayDayMonthTime(at)} · ${t.technician.fullName}`;
    if (key === 'EN_ROUTE' && state === 'NOW') return `از ${time(at)}`;
    return weekdayDayMonthTime(at);
  };

  return (
    <>
      <section className="flex flex-col gap-3 rounded-card border border-border bg-card p-4">
        <div className="text-xs text-subtle-foreground">
          سفارش <span className="ltr-code">{t.code}</span>
        </div>
        <div className={cn('text-xl font-extrabold', t.status === 'CANCELLED' && 'text-destructive')}>{headline}</div>
        {t.technician && (
          <div className="flex items-center justify-between rounded-touch bg-background p-3">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-full bg-border font-bold">{t.technician.fullName.charAt(0)}</span>
              <span className="text-sm font-bold">{t.technician.fullName}</span>
            </div>
            <Button asChild size="sm" aria-label="تماس با تکنسین">
              <a href={`tel:${t.technician.phone}`}>
                <Phone className="size-4" aria-hidden />
                تماس
              </a>
            </Button>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-subtle-foreground">زمان نصب</span>
          <span className="font-semibold">
            {weekdayDayMonth(t.scheduledDate)} · {slotRange(t.slot.startTime, t.slot.endTime)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-subtle-foreground">باتری</span>
          <span className="font-semibold">
            {t.battery.brand} · {faNumber(t.battery.capacityAh)} آمپر
          </span>
        </div>
      </section>

      <section className="rounded-card border border-border bg-card p-4">
        <h2 className="mt-0 mb-4 text-base font-bold">مراحل سفارش</h2>
        <ol className="m-0 list-none p-0">
          {t.milestones.map((m, i) => {
            const done = m.state === 'DONE';
            const now = m.state === 'NOW' && t.status !== 'CANCELLED';
            const last = i === t.milestones.length - 1;
            return (
              <li key={m.key} className="flex gap-3">
                <div className="flex w-6 shrink-0 flex-col items-center">
                  <span
                    className={cn(
                      'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                      done && 'bg-foreground text-white',
                      now && 'border-2 border-foreground bg-card shadow-[inset_0_0_0_4px_#fff,inset_0_0_0_12px_var(--foreground)]',
                      !done && !now && 'border-[1.5px] border-slate-300 bg-card',
                    )}
                  >
                    {done ? '✓' : ''}
                  </span>
                  {!last && <span className={cn('min-h-4 w-0.5 flex-1', done ? 'bg-foreground' : 'bg-border')} />}
                </div>
                <div className="flex flex-col pb-4">
                  <span className={cn('text-sm', done || now ? 'font-bold' : 'text-subtle-foreground')}>{TRACKING_MILESTONE_LABELS[m.key]}</span>
                  <span className="text-xs text-subtle-foreground">{meta(m.key, m.at, now ? 'NOW' : m.state)}</span>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </>
  );
}
