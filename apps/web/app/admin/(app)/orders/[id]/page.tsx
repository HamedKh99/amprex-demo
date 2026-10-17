'use client';

import {
  INSTALL_LOCATION_LABELS,
  ORDER_STATUS_LABELS,
  ROLE_LABELS,
  STOCK_MOVEMENT_LABELS,
  VEHICLE_TYPE_LABELS,
  type StockMovementType,
} from '@amprex/shared';
import { ChevronLeft, Phone, UserPlus, XCircle } from 'lucide-react';
import Link from 'next/link';
import { use, useState } from 'react';
import { AssignSheet } from '@/components/admin/assign-sheet';
import { CancelDialog } from '@/components/admin/cancel-dialog';
import { Fact, KV, Panel } from '@/components/admin/panel';
import { ErrorState } from '@/components/states';
import { StatusBadge } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { dayMonthTime, faDigits, faNumber, faPhone, fullDateTime, slotRange, toman, weekdayDayMonth } from '@/lib/format';
import { useOrder, useSettings } from '@/lib/queries';
import type { OrderDetail } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const order = useOrder(id);

  return (
    <>
      <nav aria-label="مسیر" className="flex items-center gap-1.5 text-[13px] text-subtle-foreground">
        <Link href="/admin/orders" className="text-muted-foreground no-underline">
          سفارش‌ها
        </Link>
        <ChevronLeft className="size-3.5" aria-hidden />
        <span className="ltr-code text-foreground">{order.data?.code ?? '…'}</span>
      </nav>
      {order.isPending && <DetailSkeleton />}
      {order.isError && (
        <div className="rounded-card border border-border bg-card">
          <ErrorState error={order.error} title="بارگذاری سفارش ناموفق بود" onRetry={() => order.refetch()} retrying={order.isFetching} />
        </div>
      )}
      {order.isSuccess && <OrderView order={order.data} />}
    </>
  );
}

function OrderView({ order: o }: { order: OrderDetail }) {
  const [assignOpen, setAssignOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const settings = useSettings();
  const canAssign = o.allowedTransitions.includes('ASSIGNED');
  const canCancel = o.allowedTransitions.includes('CANCELLED');
  const done = o.status === 'COMPLETED';
  const payment = o.payments.at(-1);
  const mismatch = payment ? BigInt(payment.expectedRial) - BigInt(payment.amountRial) : 0n;
  const core = o.coreReturn;
  const lastMove = o.movements.at(-1);

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="ltr-code m-0 text-2xl font-extrabold">{o.code}</h1>
            <StatusBadge status={o.status} />
          </div>
          <div className="text-[13px] text-subtle-foreground">
            ثبت: {fullDateTime(o.createdAt)} · کانال: {o.channel.nameFa} · {o.branch.name}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canCancel && (
            <Button variant="danger" onClick={() => setCancelOpen(true)}>
              <XCircle aria-hidden />
              لغو سفارش
            </Button>
          )}
          {canAssign && (
            <Button variant="primary" onClick={() => setAssignOpen(true)}>
              <UserPlus aria-hidden />
              تخصیص تکنسین
            </Button>
          )}
        </div>
      </header>

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 grow-[2] shrink basis-[520px] flex-col gap-4">
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
            <Panel
              title="مشتری"
              aside={
                <Button asChild size="sm" className="h-8 px-2.5 text-[13px]">
                  <a href={`tel:${o.customer.phone}`}>
                    <Phone className="size-4" aria-hidden />
                    تماس
                  </a>
                </Button>
              }
            >
              <KV label="نام">{o.customer.fullName}</KV>
              <KV label="موبایل">
                <span className="ltr-code">{faPhone(o.customer.phone)}</span>
              </KV>
              <KV label="سفارش‌های قبلی">
                {o.customerHistory.previousOrders
                  ? `${faNumber(o.customerHistory.previousOrders)} سفارش · ${jalaliYear(o.customerHistory.firstOrderAt!)}`
                  : '—'}
              </KV>
            </Panel>
            <Panel title="وسیله نقلیه" aside={<Badge variant="neutral">{VEHICLE_TYPE_LABELS[o.vehicleModel.type]}</Badge>}>
              <KV label="برند">{o.vehicleModel.brandFa}</KV>
              <KV label="مدل">{o.vehicleModel.nameFa}</KV>
              <KV label="مشخصه کارخانه">
                {faNumber(o.vehicleModel.factoryAh)} آمپر · {o.vehicleModel.groupSize}
              </KV>
            </Panel>
          </div>

          <Panel
            title="باتری"
            aside={o.batteryMatchesFactorySpec ? <Badge variant="dark">پیشنهادی</Badge> : <Badge variant="outline">جایگزین</Badge>}
            bodyClassName="grid gap-3.5"
          >
            <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
              <Fact label="محصول">{o.battery.nameFa}</Fact>
              <Fact label="CCA / گارانتی">
                {faNumber(o.battery.coldCrankingA)} · {faNumber(o.battery.warrantyMonths)} ماه
              </Fact>
              <Fact label="رزرو انبار">
                {lastMove?.type === 'RESERVE'
                  ? `${lastMove.branch.name} · ${faNumber(1)} عدد`
                  : lastMove
                    ? STOCK_MOVEMENT_LABELS[lastMove.type as StockMovementType]
                    : '—'}
              </Fact>
              {o.mission?.installedSerial ? (
                <Fact label="سریال">
                  <span className="ltr-code">{o.mission.installedSerial}</span>
                </Fact>
              ) : (
                <Fact label="سریال" muted>
                  پس از نصب ثبت می‌شود
                </Fact>
              )}
            </div>
          </Panel>

          <Panel title="آدرس و زمان نصب">
            <div className="text-sm leading-8">
              منطقه {faNumber(o.district)} — {faDigits(o.address)}
            </div>
            <div className="grid gap-3 rounded-control bg-background p-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
              <Fact label="زمان">
                {weekdayDayMonth(o.scheduledDate)} · {slotRange(o.slot.startTime, o.slot.endTime)}
              </Fact>
              <Fact label="ظرفیت بازه">
                {faNumber(o.slotLoad.booked)} از {faNumber(o.slotLoad.capacity)} تکمیل
              </Fact>
              <Fact label="محل نصب">{INSTALL_LOCATION_LABELS[o.installLocation]}</Fact>
            </div>
            <div className="text-[13px] text-muted-foreground">توضیح مشتری: {o.customerNote ? faDigits(o.customerNote) : '—'}</div>
          </Panel>

          <History order={o} />
        </div>

        <div className="flex min-w-0 grow shrink basis-80 flex-col gap-4">
          <Panel title="مبلغ" aside={<span className="text-xs text-subtle-foreground">تومان</span>}>
            <KV label="قیمت باتری">{toman(o.batteryPriceRial)}</KV>
            <KV label="نصب در محل">{BigInt(o.installFeeRial) === 0n ? 'رایگان' : toman(o.installFeeRial)}</KV>
            <KV
              label={
                done
                  ? core?.returned
                    ? `اعتبار باتری کهنه (${faNumber(core.ampereHours ?? 0)} آمپر)`
                    : 'اعتبار باتری کهنه'
                  : o.estimatedCoreAh
                    ? `اعتبار باتری کهنه (برآورد ${faNumber(o.estimatedCoreAh)} آمپر)`
                    : 'اعتبار باتری کهنه'
              }
            >
              <span dir="ltr">−{toman(o.coreCreditRial)}</span>
            </KV>
            <div className="h-px bg-border" />
            <div className="flex justify-between gap-3 text-[15px]">
              <span className="font-bold">{done ? 'قابل پرداخت' : 'قابل پرداخت (برآورد)'}</span>
              <span className="font-extrabold">{toman(o.totalRial)}</span>
            </div>
            {payment ? (
              <KV label="دریافت‌شده">{toman(payment.amountRial)}</KV>
            ) : (
              <KV label="دریافت‌شده" muted>
                — پس از نصب
              </KV>
            )}
            {mismatch !== 0n && (
              <div className="text-[13px] font-semibold text-destructive">
                مغایرت: {toman((mismatch < 0n ? -mismatch : mismatch).toString())} تومان {mismatch > 0n ? 'کمتر' : 'بیشتر'}
              </div>
            )}
            {o.financials && (
              <div className="flex flex-col gap-2 rounded-control bg-background px-3 py-2.5">
                <KV label="بهای تمام‌شده باتری">{toman(o.financials.batteryCostRial)}</KV>
                <KV label="ارزش بازیافت باتری کهنه">{toman(o.financials.coreScrapValueRial)}</KV>
                <KV label={o.financials.isEstimate ? 'سود ناخالص (برآورد)' : 'سود ناخالص'}>{toman(o.financials.grossProfitRial)}</KV>
              </div>
            )}
          </Panel>

          <Panel
            title="باتری کهنه (داغی)"
            aside={
              !core ? (
                <Badge variant="outline">در انتظار تحویل</Badge>
              ) : core.returned ? (
                <Badge variant="success">تحویل شد</Badge>
              ) : (
                <Badge variant="neutral">تحویل نشد</Badge>
              )
            }
          >
            <KV label="آمپر اعلامی">{o.estimatedCoreAh ? `${faNumber(o.estimatedCoreAh)} (فرض پیش‌فرض)` : '—'}</KV>
            <KV label="آمپر ثبت‌شده توسط تکنسین" muted={!core?.ampereHours}>
              {core?.ampereHours ? faNumber(core.ampereHours) : '—'}
            </KV>
            <KV label="نرخ اعتبار">{settings.data ? `${toman(settings.data.coreCreditPerAhRial)} به ازای هر آمپر` : '—'}</KV>
          </Panel>

          <MissionTimeline order={o} />
        </div>
      </div>

      <AssignSheet order={o} open={assignOpen} onOpenChange={setAssignOpen} />
      <CancelDialog order={o} open={cancelOpen} onOpenChange={setCancelOpen} />
    </>
  );
}

function jalaliYear(iso: string) {
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { timeZone: 'Asia/Tehran', year: 'numeric' }).format(new Date(iso));
}

interface HistoryRow {
  id: string;
  at: string;
  who: string;
  role: string;
  field: string;
  from: string;
  to: string;
}

/** Design «تاریخچه تغییرات»: status changes, branch-note edits and stock reservation, newest first. */
function History({ order: o }: { order: OrderDetail }) {
  const rows: HistoryRow[] = [];
  for (const e of o.events) {
    const who = e.actor
      ? { who: e.actor.fullName, role: ROLE_LABELS[e.actor.role] }
      : e.kind === 'STATUS' && !e.fromStatus
        ? { who: o.customer.fullName, role: `مشتری · ${o.channel.nameFa}` }
        : { who: 'سیستم', role: 'خودکار' };
    if (e.kind === 'NOTE') {
      const d = (e.data ?? {}) as { from?: string | null; to?: string | null };
      rows.push({ id: e.id, at: e.createdAt, ...who, field: 'یادداشت داخلی', from: d.from || '—', to: d.to || '—' });
    } else if (!e.fromStatus) {
      rows.push({ id: e.id, at: e.createdAt, ...who, field: 'سفارش', from: '—', to: 'ایجاد شد' });
    } else {
      rows.push({
        id: e.id,
        at: e.createdAt,
        ...who,
        field: 'وضعیت',
        from: ORDER_STATUS_LABELS[e.fromStatus],
        to: ORDER_STATUS_LABELS[e.toStatus!],
      });
    }
  }
  for (const m of o.movements) {
    if (m.type !== 'RESERVE' && m.type !== 'RELEASE') continue;
    const held = `${m.branch.name}، ${faNumber(1)} عدد`;
    rows.push({
      id: m.id,
      at: m.createdAt,
      who: 'سیستم',
      role: 'خودکار',
      field: 'رزرو موجودی',
      from: m.type === 'RESERVE' ? '—' : held,
      to: m.type === 'RESERVE' ? held : '—',
    });
  }
  rows.sort((a, b) => b.at.localeCompare(a.at));

  return (
    <Panel title="تاریخچه تغییرات" aside={<span className="text-xs text-subtle-foreground">{faNumber(rows.length)} رویداد</span>} flush>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-[13px]">
          <thead>
            <tr className="bg-background text-subtle-foreground">
              {['زمان', 'کاربر', 'فیلد', 'از ← به'].map((h) => (
                <th key={h} className="px-[18px] py-2.5 text-right font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-muted">
                <td className="px-[18px] py-[11px] whitespace-nowrap text-muted-foreground">{dayMonthTime(r.at)}</td>
                <td className="px-[18px] py-[11px] whitespace-nowrap">
                  <div className="font-semibold">{r.who}</div>
                  <div className="text-[11px] text-subtle-foreground">{r.role}</div>
                </td>
                <td className="px-[18px] py-[11px]">{r.field}</td>
                <td className="px-[18px] py-[11px]">
                  <span className="text-subtle-foreground line-through">{r.from}</span>
                  <span className="px-2 text-strong-border">←</span>
                  <span className="font-semibold">{r.to}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/** Design «مأموریت»: the eight steps with their times; the next open one is «در انتظار». */
function MissionTimeline({ order: o }: { order: OrderDetail }) {
  const m = o.mission;
  const reserve = o.movements.find((x) => x.type === 'RESERVE');
  const steps: [string, string | null | undefined][] = [
    ['ثبت سفارش', o.createdAt],
    ['رزرو باتری', reserve?.createdAt],
    ['تخصیص تکنسین', m?.assignedAt],
    ['پذیرش', m?.acceptedAt],
    ['حرکت', m?.departedAt],
    ['رسیدن', m?.arrivedAt],
    ['شروع کار', m?.startedAt],
    ['ثبت پایان و تسویه', m?.installedAt],
  ];
  const cancelled = o.status === 'CANCELLED';
  const firstOpen = steps.findIndex(([, at]) => !at);
  const items = cancelled
    ? [...steps.filter(([, at]) => at), [ORDER_STATUS_LABELS.CANCELLED, o.cancelledAt] as [string, string | null]]
    : steps;

  return (
    <Panel
      title="مأموریت"
      aside={<span className="text-xs text-subtle-foreground">تکنسین: {m?.technician.fullName ?? 'تعیین نشده'}</span>}
      flush
    >
      <ol className="m-0 list-none px-[18px] pt-4 pb-1.5">
        {items.map(([title, at], i) => {
          const isDone = !!at;
          const isNow = !cancelled && i === firstOpen;
          const last = i === items.length - 1;
          return (
            <li key={title} className="flex gap-3">
              <div className="flex w-5 shrink-0 flex-col items-center">
                <span
                  className={cn(
                    'flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                    isDone && 'bg-foreground text-white',
                    isNow && 'border-2 border-foreground shadow-[inset_0_0_0_3px_#fff,inset_0_0_0_10px_var(--foreground)]',
                    !isDone && !isNow && 'border-[1.5px] border-slate-300 bg-card',
                  )}
                >
                  {isDone ? '✓' : ''}
                </span>
                {!last && <span className={cn('min-h-3 w-0.5 flex-1', isDone ? 'bg-foreground' : 'bg-border')} />}
              </div>
              <div className="flex flex-1 justify-between gap-2 pb-3.5">
                <span className={cn('text-[13px]', isDone || isNow ? 'font-bold' : 'text-subtle-foreground')}>{title}</span>
                <span className="text-xs text-subtle-foreground">{at ? dayMonthTime(at) : isNow ? 'در انتظار' : ''}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

function DetailSkeleton() {
  return (
    <div role="status" aria-label="در حال بارگذاری سفارش" className="flex flex-col gap-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <div className="flex flex-wrap gap-4">
        <div className="flex grow-[2] basis-[520px] flex-col gap-4">
          <Skeleton className="h-40 rounded-card" />
          <Skeleton className="h-28 rounded-card" />
          <Skeleton className="h-64 rounded-card" />
        </div>
        <div className="flex grow basis-80 flex-col gap-4">
          <Skeleton className="h-64 rounded-card" />
          <Skeleton className="h-40 rounded-card" />
        </div>
      </div>
    </div>
  );
}
