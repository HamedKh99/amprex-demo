'use client';

import { ORDER_STATUS_LABELS, type OrderStatus } from '@amprex/shared';
import { BadgeCheck, CalendarDays, ChartNoAxesColumn, ClipboardList, Clock, Phone, PartyPopper } from 'lucide-react';
import Link from 'next/link';
import { EmptyState, ErrorState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { faNumber, fullDate, slotRange, time, toman, tomanMillions } from '@/lib/format';
import { useDashboard } from '@/lib/queries';
import type { Dashboard, DashboardAlert } from '@/lib/types';
import { useSession } from '@/lib/use-session';
import { cn } from '@/lib/utils';

const BAR_COLOR: Partial<Record<OrderStatus, string>> = {
  CREATED: 'bg-slate-700',
  COMPLETED: 'bg-success',
  CANCELLED: 'bg-destructive',
};

const CURRENT: Record<Dashboard['technicians'][number]['current'], { label: string; variant: 'dark' | 'neutral' | 'outline' }> = {
  EN_ROUTE: { label: ORDER_STATUS_LABELS.EN_ROUTE, variant: 'dark' },
  ON_SITE: { label: ORDER_STATUS_LABELS.ON_SITE, variant: 'dark' },
  INSTALLING: { label: ORDER_STATUS_LABELS.INSTALLING, variant: 'dark' },
  FREE: { label: 'آزاد', variant: 'neutral' },
  FULL: { label: 'ظرفیت تکمیل', variant: 'outline' },
  // Not used for "current", but keeps the record total.
  CREATED: { label: ORDER_STATUS_LABELS.CREATED, variant: 'neutral' },
  ASSIGNED: { label: ORDER_STATUS_LABELS.ASSIGNED, variant: 'neutral' },
  ACCEPTED: { label: ORDER_STATUS_LABELS.ACCEPTED, variant: 'neutral' },
  COMPLETED: { label: ORDER_STATUS_LABELS.COMPLETED, variant: 'neutral' },
  CANCELLED: { label: ORDER_STATUS_LABELS.CANCELLED, variant: 'neutral' },
};

export default function DashboardPage() {
  const session = useSession();
  const dash = useDashboard();
  const d = dash.data;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-extrabold">داشبورد</h1>
          <div className="text-[13px] text-subtle-foreground">
            {fullDate(new Date())} · {session?.user.branch?.name ?? 'همه شعبه‌ها'}
            {d && ` · به‌روزرسانی ${time(d.updatedAt)}`}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex h-10 items-center gap-2 rounded-control border border-border bg-card px-4 text-sm font-semibold">
            <CalendarDays className="size-[18px]" aria-hidden />
            امروز
          </span>
          <Button asChild variant="primary">
            <Link href="/order?channel=PHONE">
              <Phone aria-hidden />
              ثبت سفارش تلفنی
            </Link>
          </Button>
        </div>
      </div>

      {dash.isPending && <DashboardSkeleton />}
      {dash.isError && (
        <div className="rounded-card border border-border bg-card">
          <ErrorState error={dash.error} title="بارگذاری داشبورد ناموفق بود" onRetry={() => dash.refetch()} retrying={dash.isFetching} />
        </div>
      )}
      {d && <DashboardView d={d} />}
    </>
  );
}

function DashboardView({ d }: { d: Dashboard }) {
  const k = d.kpis;
  const max = Math.max(1, ...d.byStatus.map((b) => b.count));
  const total = d.byStatus.reduce((s, b) => s + b.count, 0);
  const kpis = [
    {
      label: 'سفارش‌های امروز',
      icon: ClipboardList,
      value: faNumber(k.ordersToday),
      sub: k.byChannel.slice(0, 3).map((c) => `${faNumber(c.count)} ${c.nameFa}`).join(' · ') || '—',
    },
    {
      label: 'در انتظار تخصیص',
      icon: Clock,
      value: faNumber(k.waitingAssignment),
      sub: k.nextWaitingSlot
        ? `${faNumber(k.nextWaitingSlot.count)} مورد برای بازه ${slotRange(k.nextWaitingSlot.slot.startTime, k.nextWaitingSlot.slot.endTime)} امروز`
        : '—',
    },
    { label: 'تکمیل‌شده', icon: BadgeCheck, value: faNumber(k.completed), sub: `${faNumber(k.completedPercent)}٪ سفارش‌های امروز` },
    ...(k.grossProfitRial !== null
      ? [
          {
            label: 'سود ناخالص امروز',
            icon: ChartNoAxesColumn,
            value: tomanMillions(k.grossProfitRial),
            unit: 'میلیون تومان',
            sub: `فروش ${tomanMillions(k.salesRial)} میلیون · پس از اعتبار باتری کهنه`,
          },
        ]
      : []),
  ];

  return (
    <>
      <section aria-label="شاخص‌ها" className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        {kpis.map((c) => (
          <div key={c.label} className="flex flex-col gap-2 rounded-card border border-border bg-card p-[18px]">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-muted-foreground">{c.label}</span>
              <span className="flex size-8 items-center justify-center rounded-control bg-muted text-slate-700">
                <c.icon className="size-[18px]" aria-hidden />
              </span>
            </div>
            <div className="text-[30px] leading-tight font-extrabold">
              {c.value} {'unit' in c && <span className="text-[13px] font-medium text-subtle-foreground">{c.unit}</span>}
            </div>
            <div className="text-xs text-subtle-foreground">{c.sub}</div>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap items-stretch gap-3.5">
        <section className="flex min-w-0 grow-[2] shrink basis-[480px] flex-col gap-4 rounded-card border border-border bg-card p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="m-0 text-base font-bold">سفارش‌های امروز بر اساس وضعیت</h2>
            <span className="text-xs text-subtle-foreground">مجموع {faNumber(total)}</span>
          </div>
          {total === 0 ? (
            <EmptyState icon={ClipboardList} title="امروز سفارشی ثبت نشده است" className="py-6" />
          ) : (
            <div
              role="img"
              aria-label={`نمودار میله‌ای: ${d.byStatus.map((b) => `${ORDER_STATUS_LABELS[b.status]} ${faNumber(b.count)}`).join('، ')}`}
              className="flex flex-col gap-3.5"
            >
              {d.byStatus.map((b) => (
                <div key={b.status} className="grid items-center gap-3" style={{ gridTemplateColumns: '120px minmax(0, 1fr) 36px' }}>
                  <span className="text-[13px] text-slate-700">{ORDER_STATUS_LABELS[b.status]}</span>
                  <span className="flex h-[22px] overflow-hidden rounded-sm bg-muted">
                    <span className={cn('h-full rounded-sm', BAR_COLOR[b.status] ?? 'bg-slate-500')} style={{ width: `${Math.round((b.count / max) * 100)}%` }} />
                  </span>
                  <span className="text-sm font-bold">{faNumber(b.count)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-4 border-t border-muted pt-3 text-xs text-subtle-foreground">
            <span>سبز: تکمیل‌شده</span>
            <span>قرمز: لغوشده</span>
            <span>خاکستری: در جریان</span>
          </div>
        </section>

        <section className="flex min-w-0 grow shrink basis-[340px] flex-col gap-1 rounded-card border border-border bg-card p-5">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="m-0 text-base font-bold">نیازمند توجه</h2>
            {d.alerts.length > 0 && <Badge variant="destructive">{faNumber(d.alerts.length)} مورد</Badge>}
          </div>
          {d.alerts.length === 0 && <EmptyState icon={PartyPopper} title="موردی برای پیگیری نیست" className="py-6" />}
          {d.alerts.map((a, i) => (
            <AlertRow key={i} a={a} />
          ))}
        </section>
      </div>

      <section className="overflow-hidden rounded-card border border-border bg-card">
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="m-0 text-base font-bold">تکنسین‌های امروز</h2>
          <Link href="/admin/orders" className="text-[13px] font-semibold">
            همه سفارش‌ها
          </Link>
        </div>
        {d.technicians.length === 0 ? (
          <EmptyState title="تکنسین فعالی ثبت نشده است" className="py-6" />
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-[13px]">
              <thead>
                <tr className="bg-background text-subtle-foreground">
                  {['تکنسین', 'منطقه', 'مأموریت امروز', 'وضعیت فعلی'].map((h) => (
                    <th key={h} className="px-5 py-2.5 text-right font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.technicians.map((t) => {
                  const pct = Math.min(100, Math.round((t.load / t.dailyCapacity) * 100));
                  const c = CURRENT[t.current];
                  return (
                    <tr key={t.id} className="border-t border-muted">
                      <td className="px-5 py-3 font-semibold">{t.fullName}</td>
                      <td className="px-5 py-3 text-muted-foreground">منطقه {t.serviceDistricts.map(faNumber).join('، ')}</td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-2">
                          <span className="inline-flex h-1.5 w-20 overflow-hidden rounded-[3px] bg-muted">
                            <span className="h-full bg-slate-600" style={{ width: `${pct}%` }} />
                          </span>
                          {faNumber(t.load)} از {faNumber(t.dailyCapacity)}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <Badge dot variant={c.variant}>
                          {c.label}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

/** One «نیازمند توجه» row; the API sends structured alerts and the wording lives here. */
function AlertRow({ a }: { a: DashboardAlert }) {
  let title: string;
  let meta: string;
  let cta: string;
  let href: string | null = null;
  switch (a.type) {
    case 'UNASSIGNED':
      title = `${faNumber(a.count)} سفارش بدون تکنسین برای ${slotRange(a.slot.startTime, a.slot.endTime)}`;
      meta = `منطقه ${a.districts.map(faNumber).join(' و ')} · ${
        a.minutesLeft > 0 ? `کمتر از ${faNumber(Math.max(1, Math.ceil(a.minutesLeft / 60)))} ساعت مانده` : 'بازه شروع شده است'
      }`;
      cta = 'تخصیص';
      href = '/admin/orders?status=CREATED&range=today';
      break;
    case 'LATE_ARRIVAL':
      title = `تأخیر رسیدن — ${a.code}`;
      meta = `${a.technician?.fullName ?? '—'} · ${faNumber(a.minutesLate)} دقیقه از بازه گذشته`;
      cta = 'تماس';
      href = `/admin/orders/${a.orderId}`;
      break;
    case 'LOW_STOCK':
      title = `موجودی کم: ${a.nameFa}`;
      meta = `${a.branchName} · ${faNumber(a.available)} عدد قابل فروش، ${faNumber(a.reservedTomorrow)} رزرو فردا`;
      cta = 'انبار';
      break;
    case 'SETTLEMENT_MISMATCH': {
      const diff = BigInt(a.differenceRial);
      title = `مغایرت تسویه — ${a.code}`;
      meta = `مبلغ دریافتی ${toman((diff < 0n ? -diff : diff).toString())} تومان ${diff > 0n ? 'کمتر' : 'بیشتر'} از قابل پرداخت`;
      cta = 'بررسی';
      href = `/admin/orders/${a.orderId}`;
      break;
    }
  }
  const body = (
    <>
      <span className={cn('mt-[7px] size-2 shrink-0 rounded-full', a.severity === 'HIGH' ? 'bg-destructive' : 'bg-slate-700')} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold" dir="auto">
          {title}
        </span>
        <span className="mt-0.5 block text-xs text-subtle-foreground">{meta}</span>
      </span>
      <span className={cn('self-center text-xs font-semibold', href ? 'text-link' : 'text-subtle-foreground')}>{cta}</span>
    </>
  );
  const cls = 'flex gap-3 border-t border-muted py-3 text-foreground no-underline';
  return href ? (
    <Link href={href} className={cn(cls, 'hover:text-foreground')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function DashboardSkeleton() {
  return (
    <div role="status" aria-label="در حال بارگذاری داشبورد" className="flex flex-col gap-5">
      <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-3 rounded-card border border-border bg-card p-[18px]">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-40" />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3.5">
        <Skeleton className="h-72 grow-[2] basis-[480px] rounded-card" />
        <Skeleton className="h-72 grow basis-[340px] rounded-card" />
      </div>
      <Skeleton className="h-56 rounded-card" />
    </div>
  );
}
