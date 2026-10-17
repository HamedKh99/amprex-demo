'use client';

import { TECHNICIAN_FIT_LABELS, type TechnicianFit } from '@amprex/shared';
import { Search, UserX } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { EmptyState, ErrorState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { dayMonth, faNumber, slotRange, tehranToday, weekdayDayMonth } from '@/lib/format';
import { useOrderMutation, useTechnicianOptions } from '@/lib/queries';
import type { OrderDetail, TechnicianOption } from '@/lib/types';
import { cn } from '@/lib/utils';

const FIT_VARIANT: Record<TechnicianFit, 'dark' | 'neutral' | 'outline' | 'destructive'> = {
  RECOMMENDED: 'dark',
  FREE: 'neutral',
  BUSY: 'outline',
  FULL: 'destructive',
};

/** Design «تخصیص تکنسین (شیت)»: ranked technicians from the API, a note, and confirm. */
export function AssignSheet({ order, open, onOpenChange }: { order: OrderDetail; open: boolean; onOpenChange: (v: boolean) => void }) {
  const options = useTechnicianOptions(order.id, open);
  const [query, setQuery] = useState('');
  const [zoneOnly, setZoneOnly] = useState(true);
  const [picked, setPicked] = useState<string | null>(null);
  const [note, setNote] = useState(order.branchNote ?? '');

  // Default to the system suggestion (or the current technician) once the list arrives.
  useEffect(() => {
    if (!open) return;
    setNote(order.branchNote ?? '');
    const list = options.data;
    if (list && picked === null) {
      setPicked(list.find((t) => t.isCurrent)?.id ?? list.find((t) => t.fit === 'RECOMMENDED')?.id ?? null);
    }
  }, [open, options.data, picked, order.branchNote]);

  const shown = useMemo(
    () => (options.data ?? []).filter((t) => (!zoneOnly || t.inZone) && t.fullName.includes(query.trim())),
    [options.data, zoneOnly, query],
  );
  const chosen = options.data?.find((t) => t.id === picked);

  const assign = useOrderMutation(order.id, () =>
    api<OrderDetail>(`/orders/${order.id}/assign`, { method: 'POST', body: { technicianId: picked, note: note.trim() } }),
  );

  const close = (v: boolean) => {
    onOpenChange(v);
    if (!v) setPicked(null);
  };

  return (
    <Sheet open={open} onOpenChange={close}>
      <SheetContent side="left" className="flex w-full flex-col gap-0 p-0 sm:max-w-[480px]">
        <header className="flex flex-col gap-3 border-b border-border px-6 pt-5 pb-4">
          <SheetTitle className="m-0 text-lg font-extrabold">تخصیص تکنسین</SheetTitle>
          <SheetDescription asChild>
            <div className="flex flex-wrap gap-2 rounded-control bg-background px-3 py-2.5 text-[13px] text-slate-700">
              <span className="ltr-code font-bold">{order.code}</span>
              <span className="text-slate-300">|</span>
              <span>
                {weekdayDayMonth(order.scheduledDate)} · {slotRange(order.slot.startTime, order.slot.endTime)}
              </span>
              <span className="text-slate-300">|</span>
              <span>منطقه {faNumber(order.district)}</span>
              <span className="text-slate-300">|</span>
              <span>{order.battery.nameFa}</span>
            </div>
          </SheetDescription>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <label htmlFor="ts" className="sr-only">
                جستجوی تکنسین
              </label>
              <Input id="ts" placeholder="جستجوی نام تکنسین" value={query} onChange={(e) => setQuery(e.target.value)} className="h-[38px] ps-[34px] text-[13px]" />
              <Search className="pointer-events-none absolute top-2.5 right-2.5 size-4 text-subtle-foreground" aria-hidden />
            </div>
            <Button size="sm" aria-pressed={zoneOnly} onClick={() => setZoneOnly((z) => !z)} className={cn('text-[13px]', zoneOnly && 'border-strong-border bg-muted')}>
              فقط منطقه {faNumber(order.district)}
            </Button>
          </div>
        </header>

        <div role="radiogroup" aria-label="تکنسین‌ها" className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-6 py-4">
          {options.isPending &&
            [0, 1, 2].map((i) => (
              <div key={i} role="status" aria-label="در حال بارگذاری تکنسین‌ها" className="flex gap-3 rounded-card border border-border p-3.5">
                <Skeleton className="size-10 rounded-full" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                  <Skeleton className="h-2 w-full" />
                </div>
              </div>
            ))}
          {options.isError && <ErrorState error={options.error} title="بارگذاری تکنسین‌ها ناموفق بود" onRetry={() => options.refetch()} />}
          {options.isSuccess && shown.length === 0 && (
            <EmptyState icon={UserX} title="تکنسینی پیدا نشد" description="جستجو را کوتاه‌تر کنید یا فیلتر منطقه را بردارید.">
              {zoneOnly && <Button onClick={() => setZoneOnly(false)}>همه تکنسین‌ها</Button>}
            </EmptyState>
          )}
          {shown.map((t) => (
            <TechOption key={t.id} t={t} order={order} checked={t.id === picked} onPick={() => setPicked(t.id)} />
          ))}
        </div>

        <footer className="flex flex-col gap-3 border-t border-border px-6 pt-4 pb-5">
          <div>
            <label htmlFor="tn" className="mb-1.5 block text-[13px] font-semibold">
              یادداشت برای تکنسین <span className="font-normal text-subtle-foreground">(اختیاری)</span>
            </label>
            <Input id="tn" value={note} onChange={(e) => setNote(e.target.value)} className="h-10 text-[13px]" />
          </div>
          <div className="flex gap-2">
            <Button
              variant="primary"
              className="flex-1"
              disabled={!chosen || chosen.full || assign.isPending}
              onClick={() =>
                assign.mutate(undefined, {
                  onSuccess: () => {
                    toast.success(`سفارش به ${chosen!.fullName} تخصیص یافت.`);
                    close(false);
                  },
                  onError: (e) => toast.error(e.message),
                })
              }
            >
              {chosen ? `تخصیص به ${chosen.fullName}` : 'تخصیص تکنسین'}
            </Button>
            <Button onClick={() => close(false)}>انصراف</Button>
          </div>
        </footer>
      </SheetContent>
    </Sheet>
  );
}

function TechOption({ t, order, checked, onPick }: { t: TechnicianOption; order: OrderDetail; checked: boolean; onPick: () => void }) {
  const pct = Math.min(100, Math.round((t.load / t.dailyCapacity) * 100));
  // Load is for the order's day; the design wording assumes that day is today.
  const day = order.scheduledDate === tehranToday() ? 'امروز' : dayMonth(order.scheduledDate);
  const slot = `بازه ${slotRange(order.slot.startTime, order.slot.endTime)} روز ${dayMonth(order.scheduledDate)}: ${
    t.full ? 'ظرفیت تکمیل' : t.slotJobs === 0 ? 'آزاد' : `${faNumber(t.slotJobs)} مأموریت دیگر`
  }`;
  const zones = `منطقه ${t.serviceDistricts.map(faNumber).join('، ')}${
    t.inZone ? (t.zoneJobs > 0 ? ` · ${day} ${faNumber(t.zoneJobs)} مأموریت در منطقه ${faNumber(order.district)}` : '') : ' · خارج از منطقه سفارش'
  }`;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      aria-disabled={t.full}
      disabled={t.full}
      onClick={onPick}
      className={cn(
        'flex w-full rounded-card bg-card p-3.5 text-start text-foreground',
        checked ? 'border-2 border-foreground p-[13px]' : 'border border-border',
        t.full && 'cursor-not-allowed bg-background opacity-70',
      )}
    >
      <span className="flex w-full items-start gap-3">
        <span className={cn('mt-[11px] size-[18px] shrink-0 rounded-full', checked ? 'border-[5px] border-foreground' : 'border-[1.5px] border-strong-border')} />
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-border font-bold">{t.fullName.charAt(0)}</span>
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex items-center justify-between gap-2">
            <span className="text-[15px] font-bold">{t.fullName}</span>
            <Badge variant={FIT_VARIANT[t.fit]}>{TECHNICIAN_FIT_LABELS[t.fit]}</Badge>
          </span>
          <span className="text-xs text-subtle-foreground">{zones}</span>
          <span className="flex items-center gap-2.5 text-xs text-slate-700">
            <span className="whitespace-nowrap">بار {day}</span>
            <span className="flex h-1.5 flex-1 overflow-hidden rounded-[3px] bg-muted">
              <span className={cn('h-full', pct >= 100 ? 'bg-destructive' : 'bg-slate-600')} style={{ width: `${pct}%` }} />
            </span>
            <span className="font-bold whitespace-nowrap">
              {faNumber(t.load)} از {faNumber(t.dailyCapacity)}
            </span>
          </span>
          <span className="text-xs text-muted-foreground">{slot}</span>
        </span>
      </span>
    </button>
  );
}
