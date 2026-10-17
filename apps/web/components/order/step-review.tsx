'use client';

import { INSTALL_LOCATION_LABELS } from '@amprex/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Info, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { ErrorState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiRequestError, api } from '@/lib/api';
import { faDigits, faNumber, slotRange, toman, weekdayDayMonth } from '@/lib/format';
import type { OrderDraft } from '@/lib/order-draft';
import { useAvailability, useCompatible, useSettings } from '@/lib/queries';
import type { OrderDetail } from '@/lib/types';
import { StepShell } from './shared';

export const LAST_ORDER_KEY = 'amprex.lastOrder';

/** Step 5 «بازبینی و ثبت»: everything chosen, the API's price estimate, and «ثبت سفارش». */
export function StepReview({
  draft,
  update,
  onBack,
  goTo,
}: {
  draft: OrderDraft;
  update: (p: Partial<OrderDraft>) => void;
  onBack: () => void;
  goTo: (step: number) => void;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const fit = useCompatible(draft.vehicleModelId, draft.district);
  const availability = useAvailability(draft.district);
  const settings = useSettings();
  const [accepted, setAccepted] = useState(true);
  const [placing, setPlacing] = useState(false);

  const battery = fit.data?.batteries.find((b) => b.id === draft.batteryId);
  const vehicle = fit.data?.vehicle;
  const day = availability.data?.days.find((d) => d.date === draft.scheduledDate);
  const slot = day?.slots.find((s) => s.id === draft.slotId);

  const place = async () => {
    if (!accepted || placing) return;
    // One key per checkout attempt: a retry after a lost response returns the same order.
    const key = draft.idempotencyKey ?? crypto.randomUUID();
    if (!draft.idempotencyKey) update({ idempotencyKey: key });
    setPlacing(true);
    try {
      const order = await api<OrderDetail>('/orders', {
        method: 'POST',
        headers: { 'Idempotency-Key': key },
        body: {
          customerName: draft.customerName,
          customerPhone: draft.customerPhone,
          vehicleModelId: draft.vehicleModelId,
          batteryId: draft.batteryId,
          district: draft.district,
          address: draft.address,
          installLocation: draft.installLocation,
          scheduledDate: draft.scheduledDate,
          slotId: draft.slotId,
          customerNote: draft.customerNote || undefined,
          channelCode: draft.channelCode,
        },
      });
      try {
        sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify(order));
      } catch {
        /* the success page falls back to tracking */
      }
      router.push(`/order/success?code=${encodeURIComponent(order.code)}`);
    } catch (e) {
      setPlacing(false);
      const code = e instanceof ApiRequestError ? e.code : '';
      toast.error((e as Error).message);
      // Nothing was created: a fresh attempt gets a fresh key.
      if (code === 'OUT_OF_STOCK') {
        update({ batteryId: undefined, idempotencyKey: undefined });
        void qc.invalidateQueries({ queryKey: ['catalog', 'compatible'] });
        goTo(2);
      } else if (code === 'SLOT_FULL' || code === 'INVALID_BOOKING_DATE') {
        update({ idempotencyKey: undefined });
        await qc.invalidateQueries({ queryKey: ['availability'] });
        goTo(4);
      }
    }
  };

  const loading = fit.isPending || availability.isPending;
  const failed = fit.isError || availability.isError;

  return (
    <StepShell
      step={5}
      onBack={onBack}
      bottom={
        <>
          <Button variant="primary" size="lg" className="w-full" disabled={!accepted || placing || !battery || !slot} onClick={place}>
            {placing && <Loader2 className="animate-spin" aria-hidden />}
            ثبت سفارش
          </Button>
          <p className="m-0 text-center text-xs text-subtle-foreground">پرداخت فقط پس از نصب، در محل</p>
        </>
      }
    >
      <h1 className="m-0 text-lg font-extrabold">بازبینی و ثبت</h1>
      {loading && (
        <div role="status" aria-label="در حال بارگذاری" className="flex flex-col gap-3">
          <Skeleton className="h-56 rounded-card" />
          <Skeleton className="h-40 rounded-card" />
        </div>
      )}
      {failed && (
        <ErrorState
          error={fit.error ?? availability.error}
          title="بارگذاری اطلاعات سفارش ناموفق بود"
          onRetry={() => {
            void fit.refetch();
            void availability.refetch();
          }}
        />
      )}

      {!loading && !failed && vehicle && battery && (
        <>
          <section className="rounded-card border border-border bg-card px-4">
            <ReviewRow label="وسیله نقلیه" onEdit={() => goTo(1)}>
              {vehicle.nameFa} · {vehicle.brandFa}
            </ReviewRow>
            <ReviewRow label="باتری" onEdit={() => goTo(2)}>
              {battery.brand} · {faNumber(battery.capacityAh)} آمپر · CCA {faNumber(battery.coldCrankingA)} · گارانتی {faNumber(battery.warrantyMonths)} ماه
            </ReviewRow>
            <ReviewRow label="تماس و آدرس" onEdit={() => goTo(3)}>
              {draft.customerName} · {faDigits(draft.customerPhone ?? '')}
              <br />
              منطقه {faNumber(draft.district ?? 0)} — {faDigits(draft.address ?? '')} · {INSTALL_LOCATION_LABELS[draft.installLocation]}
            </ReviewRow>
            <ReviewRow label="زمان نصب" onEdit={() => goTo(4)} last>
              {day && slot ? `${weekdayDayMonth(day.date)} · ساعت ${slotRange(slot.startTime, slot.endTime)}` : '—'}
            </ReviewRow>
          </section>

          <section className="flex flex-col gap-2.5 rounded-card border border-border bg-card p-4">
            <h2 className="m-0 text-base font-bold">جزئیات مبلغ</h2>
            <PriceRow label="قیمت باتری">{toman(battery.price.batteryPriceRial)} تومان</PriceRow>
            <PriceRow label="نصب و تست در محل">{BigInt(battery.price.installFeeRial) === 0n ? 'رایگان' : `${toman(battery.price.installFeeRial)} تومان`}</PriceRow>
            {battery.price.estimatedCoreAh && (
              <PriceRow label={`اعتبار باتری کهنه (برآورد ${faNumber(battery.price.estimatedCoreAh)} آمپر)`}>
                <span dir="ltr">−{toman(battery.price.coreCreditRial)}</span> تومان
              </PriceRow>
            )}
            <div className="h-px bg-border" />
            <div className="flex justify-between gap-3 text-[15px]">
              <span className="font-bold">مبلغ تقریبی، قابل پرداخت در محل</span>
              <span className="font-extrabold whitespace-nowrap">{toman(battery.price.totalRial)} تومان</span>
            </div>
          </section>

          <section className="flex flex-col gap-3 rounded-card bg-muted p-4">
            <div className="flex gap-2.5">
              <Info className="mt-1 size-[18px] shrink-0 text-slate-700" aria-hidden />
              <div>
                <h3 className="m-0 text-sm font-bold">مبلغ نهایی در محل نصب مشخص می‌شود</h3>
                <p className="mt-1 mb-0 text-[13px] leading-7 text-slate-700">
                  اعتبار باتری کهنه بر اساس آمپر واقعی آن حساب می‌شود: هر آمپر{' '}
                  <strong>{settings.data ? toman(settings.data.coreCreditPerAhRial) : '…'} تومان</strong>. برآورد بالا فرض کرده باتری فعلی شما
                  هم‌آمپر باتری جدید ({faNumber(battery.capacityAh)} آمپر) است. تکنسین آمپر باتری کهنه را روی برچسب آن بررسی می‌کند و مبلغ را پیش از
                  پرداخت به شما نشان می‌دهد.
                </p>
              </div>
            </div>
            <table className="w-full border-collapse overflow-hidden rounded-control bg-card text-[13px]">
              <thead>
                <tr className="text-subtle-foreground">
                  <th className="px-3 py-2 text-right font-semibold">باتری کهنه شما</th>
                  <th className="px-3 py-2 text-left font-semibold">مبلغ نهایی</th>
                </tr>
              </thead>
              <tbody>
                {battery.finalPriceExamples.map((ex) => (
                  <tr key={String(ex.oldAh)} className={ex.isEstimate ? 'bg-background font-bold' : ''}>
                    <td className="border-t border-muted px-3 py-2">
                      {ex.oldAh === null ? 'بدون باتری کهنه' : `${faNumber(ex.oldAh)} آمپر${ex.isEstimate ? ' (برآورد فعلی)' : ''}`}
                    </td>
                    <td className="border-t border-muted px-3 py-2 text-left">{toman(ex.totalRial)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <label className="flex items-center gap-2 text-[13px] text-slate-700">
            <Checkbox checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} />
            شرایط نصب و گارانتی را خوانده‌ام و می‌پذیرم.
          </label>
        </>
      )}
    </StepShell>
  );
}

function ReviewRow({ label, children, onEdit, last }: { label: string; children: React.ReactNode; onEdit: () => void; last?: boolean }) {
  return (
    <div className={`flex items-start justify-between gap-3 py-3 ${last ? '' : 'border-b border-muted'}`}>
      <div className="min-w-0">
        <div className="text-xs text-subtle-foreground">{label}</div>
        <div className="text-sm leading-7">{children}</div>
      </div>
      <Button variant="link" className="shrink-0 text-[13px] font-semibold" onClick={onEdit}>
        ویرایش
      </Button>
    </div>
  );
}

function PriceRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 text-[13px]">
      <span className="text-subtle-foreground">{label}</span>
      <span className="font-semibold whitespace-nowrap">{children}</span>
    </div>
  );
}
