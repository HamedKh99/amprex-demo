'use client';

import { CalendarX, Info } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState, ErrorState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { dayPickerParts, faNumber, slotRange, weekdayDayMonth } from '@/lib/format';
import type { OrderDraft } from '@/lib/order-draft';
import { useAvailability } from '@/lib/queries';
import type { Availability } from '@/lib/types';
import { cn } from '@/lib/utils';
import { RadioDot, StepShell } from './shared';

type Day = Availability['days'][number];
type Slot = Day['slots'][number];

/** First open slot at or after (date, startTime), scanning later days too. */
function nearestOpen(days: Day[], date?: string, after?: string): { day: Day; slot: Slot } | null {
  for (const day of days) {
    if (date && day.date < date) continue;
    for (const slot of day.slots) {
      if (slot.state !== 'OPEN') continue;
      if (date && after && day.date === date && slot.startTime < after) continue;
      return { day, slot };
    }
  }
  return null;
}

/** Step 4 «زمان نصب»: day strip and slots with remaining capacity from the API. */
export function StepSlot({ draft, update, onNext, onBack }: { draft: OrderDraft; update: (p: Partial<OrderDraft>) => void; onNext: () => void; onBack: () => void }) {
  const availability = useAvailability(draft.district);
  const days = availability.data?.days ?? [];
  const [viewDate, setViewDate] = useState<string | undefined>(draft.scheduledDate);
  const [moved, setMoved] = useState<{ from: string; to: string } | null>(null);
  const checked = useRef(false);

  // If the chosen slot filled up meanwhile, move to the nearest free one and say so.
  useEffect(() => {
    if (!availability.data || checked.current) return;
    checked.current = true;
    const list = availability.data.days;
    const day = list.find((d) => d.date === draft.scheduledDate);
    const slot = day?.slots.find((s) => s.id === draft.slotId);
    if (draft.slotId && (!slot || slot.state !== 'OPEN')) {
      const next = nearestOpen(list, draft.scheduledDate, slot?.startTime);
      if (next) {
        update({ scheduledDate: next.day.date, slotId: next.slot.id });
        setViewDate(next.day.date);
        if (slot) setMoved({ from: slotRange(slot.startTime, slot.endTime), to: slotRange(next.slot.startTime, next.slot.endTime) });
      } else {
        update({ scheduledDate: undefined, slotId: undefined });
      }
    } else if (!draft.scheduledDate) {
      setViewDate(list.find((d) => !d.isFull)?.date ?? list[0]?.date);
    }
  }, [availability.data, draft.scheduledDate, draft.slotId, update]);

  const shown = days.find((d) => d.date === viewDate) ?? days[0];
  const visibleSlots = useMemo(() => shown?.slots.filter((s) => s.state !== 'CLOSED') ?? [], [shown]);
  const chosenDay = days.find((d) => d.date === draft.scheduledDate);
  const chosenSlot = chosenDay?.slots.find((s) => s.id === draft.slotId && s.state === 'OPEN');

  return (
    <StepShell
      step={4}
      onBack={onBack}
      bottom={
        <>
          {chosenDay && chosenSlot && (
            <div className="flex justify-between text-[13px]">
              <span className="text-muted-foreground">زمان انتخابی</span>
              <span className="font-bold">
                {weekdayDayMonth(chosenDay.date)} · {slotRange(chosenSlot.startTime, chosenSlot.endTime)}
              </span>
            </div>
          )}
          <Button variant="primary" size="lg" className="w-full" disabled={!chosenSlot} onClick={onNext}>
            ادامه
          </Button>
        </>
      }
    >
      <div>
        <h1 className="m-0 text-lg font-extrabold">زمان نصب</h1>
        <p className="mt-1 mb-0 text-[13px] leading-7 text-muted-foreground">
          منطقه {faNumber(draft.district ?? 0)} · تکنسین در طول بازه انتخابی می‌رسد و ۳۰ دقیقه قبل تماس می‌گیرد.
        </p>
      </div>

      {availability.isPending && (
        <div role="status" aria-label="در حال بارگذاری زمان‌ها" className="flex flex-col gap-3">
          <div className="flex gap-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-[84px] w-[68px] shrink-0 rounded-card" />
            ))}
          </div>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-touch" />
          ))}
        </div>
      )}
      {availability.isError && (
        <ErrorState error={availability.error} title="بارگذاری زمان‌های نصب ناموفق بود" onRetry={() => availability.refetch()} retrying={availability.isFetching} />
      )}

      {availability.isSuccess && (
        <>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="روز نصب">
            {days.map((d) => {
              const p = dayPickerParts(d.date);
              const on = d.date === shown?.date;
              return (
                <button
                  key={d.date}
                  type="button"
                  aria-pressed={on}
                  disabled={d.isFull}
                  onClick={() => setViewDate(d.date)}
                  className={cn(
                    'flex h-[84px] w-[68px] shrink-0 flex-col items-center justify-center rounded-card border',
                    on ? 'border-foreground bg-foreground text-white' : 'border-border bg-card text-foreground',
                    d.isFull && 'cursor-not-allowed bg-background text-subtle-foreground',
                  )}
                >
                  <span className="text-xs">{d.isToday ? 'امروز' : p.weekday}</span>
                  <span className="text-xl font-extrabold">{p.day}</span>
                  <span className={cn('text-[11px]', on ? 'text-slate-300' : d.isFull ? 'text-destructive' : 'text-subtle-foreground')}>
                    {d.isFull ? 'تکمیل' : p.month}
                  </span>
                </button>
              );
            })}
          </div>

          {moved && (
            <div role="status" className="flex gap-2.5 rounded-card bg-muted p-3 text-[13px] leading-7 text-slate-700">
              <Info className="mt-1 size-4 shrink-0" aria-hidden />
              <span>
                بازه {moved.from} همین حالا تکمیل شد. نزدیک‌ترین بازه آزاد، {moved.to}، برای شما انتخاب شد. می‌توانید تغییرش دهید.
              </span>
            </div>
          )}

          {shown && (
            <section className="flex flex-col gap-2.5">
              <h2 className="m-0 text-base font-bold">{weekdayDayMonth(shown.date)}</h2>
              {visibleSlots.length === 0 && (
                <EmptyState icon={CalendarX} title="بازه آزادی برای این روز نمانده است" description="روز دیگری را انتخاب کنید." className="py-6" />
              )}
              <div role="radiogroup" aria-label="بازه زمانی" className="flex flex-col gap-2">
                {visibleSlots.map((s) => {
                  const on = shown.date === draft.scheduledDate && s.id === draft.slotId;
                  const full = s.state === 'FULL';
                  const used = s.capacity - s.remaining;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-disabled={full}
                      disabled={full}
                      onClick={() => {
                        setMoved(null);
                        update({ scheduledDate: shown.date, slotId: s.id });
                      }}
                      className={cn(
                        'flex min-h-16 w-full items-center justify-between rounded-touch bg-card px-3.5 text-start',
                        on ? 'border-2 border-foreground px-[13px]' : 'border border-border',
                        full && 'cursor-not-allowed bg-background text-subtle-foreground',
                      )}
                    >
                      <span className="flex items-center gap-3">
                        <RadioDot on={on} />
                        <span className="flex flex-col gap-1.5">
                          <span className="text-[15px] font-bold">ساعت {slotRange(s.startTime, s.endTime)}</span>
                          <span className="flex gap-1" aria-hidden>
                            {Array.from({ length: s.capacity }, (_, i) => (
                              <span key={i} className={cn('h-1 w-3.5 rounded-[2px]', i < used ? (full ? 'bg-slate-300' : 'bg-strong-border') : 'bg-border')} />
                            ))}
                          </span>
                        </span>
                      </span>
                      <Badge variant={full ? 'destructive' : 'neutral'}>
                        {full ? 'تکمیل' : s.remaining === 1 ? 'آخرین ظرفیت' : `${faNumber(s.remaining)} ظرفیت باقی‌مانده`}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </StepShell>
  );
}
