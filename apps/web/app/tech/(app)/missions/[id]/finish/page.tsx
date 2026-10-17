'use client';

import { ON_SITE_PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type PaymentMethod } from '@amprex/shared';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ErrorState } from '@/components/states';
import { BackHeader } from '@/components/tech/back-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { faDigits, faNumber, parseFaInt, toman, tomanInputToRial } from '@/lib/format';
import { useOrder, useOrderMutation, useSettings, useSettlement } from '@/lib/queries';
import type { OrderDetail, Settings } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function FinishPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const order = useOrder(id);
  const settings = useSettings();

  if (order.isPending || settings.isPending) return <FinishSkeleton />;
  if (order.isError || settings.isError) {
    return (
      <div className="flex min-h-dvh flex-col">
        <BackHeader title="ثبت پایان کار" href={`/tech/missions/${id}`} />
        <ErrorState
          error={order.error ?? settings.error}
          title="بارگذاری فرم ناموفق بود"
          onRetry={() => {
            void order.refetch();
            void settings.refetch();
          }}
        />
      </div>
    );
  }
  return <FinishForm order={order.data} settings={settings.data} />;
}

/** Waits until the value has been still for `ms` before letting it through. */
function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function FinishForm({ order, settings }: { order: OrderDetail; settings: Settings }) {
  const router = useRouter();
  const [serial, setSerial] = useState('');
  const [core, setCore] = useState(order.estimatedCoreAh !== null);
  const [ah, setAh] = useState(order.estimatedCoreAh ?? order.battery.capacityAh);
  const [receivedRial, setReceivedRial] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('CARD_POS');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);

  const ahValid = !core || (ah >= settings.coreAhMin && ah <= settings.coreAhMax);
  const debouncedAh = useDebounced(ah, 250);
  const quote = useSettlement(order.id, core, core ? debouncedAh : null, ahValid);
  const s = quote.data;
  const payable = s?.totalRial;
  const received = receivedRial ?? payable ?? null;
  const diff = payable && received ? BigInt(payable) - BigInt(received) : 0n;

  const finish = useOrderMutation(order.id, () =>
    api<OrderDetail>(`/missions/${order.id}/finish`, {
      method: 'POST',
      body: {
        installedSerial: serial.trim(),
        coreReturned: core,
        oldBatteryAh: core ? ah : undefined,
        receivedRial: received,
        method,
        reference: reference.trim() || undefined,
        technicianNote: note.trim() || undefined,
      },
    }),
  );

  const serialMissing = serial.trim().length < 3;
  const submit = () => {
    setTried(true);
    if (serialMissing || !ahValid || !received || quote.isFetching) return;
    finish.mutate(undefined, {
      onSuccess: () => router.replace(`/tech/missions/${order.id}/done`),
      onError: (e) => toast.error(e.message),
    });
  };
  const setAhClamped = (n: number) => {
    setAh(Math.max(0, Math.min(999, n)));
    setReceivedRial(null);
  };

  const deltaText = !s
    ? ''
    : BigInt(s.differenceRial) === 0n
      ? 'برابر با برآورد زمان ثبت سفارش'
      : BigInt(s.differenceRial) > 0n
        ? `${toman(s.differenceRial)} تومان بیشتر از برآورد (${toman(s.estimateTotalRial)}) — به مشتری توضیح دهید.`
        : `${toman((-BigInt(s.differenceRial)).toString())} تومان کمتر از برآورد (${toman(s.estimateTotalRial)})`;

  return (
    <div className="relative flex min-h-dvh flex-col">
      <BackHeader title="ثبت پایان کار" code={order.code} href={`/tech/missions/${order.id}`} />

      <main className="flex flex-col gap-3 p-4 pb-40">
        <section className="flex flex-col gap-3.5 rounded-xl border border-border bg-card p-4">
          <div>
            <span className="mb-2 block text-sm font-semibold">باتری نصب‌شده</span>
            <div className="flex min-h-14 items-center rounded-touch border border-input bg-card px-3.5">
              <span>
                <span className="block text-[15px] font-bold">{order.battery.nameFa}</span>
                <span className="block text-xs text-subtle-foreground">{toman(order.batteryPriceRial)} تومان · طبق سفارش</span>
              </span>
            </div>
          </div>
          <div>
            <label htmlFor="serial" className="mb-2 block text-sm font-semibold">
              شماره سریال
            </label>
            <Input
              id="serial"
              dir="ltr"
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
              aria-invalid={tried && serialMissing}
              autoComplete="off"
              className="h-[52px] rounded-touch font-mono text-[15px]"
            />
            {tried && serialMissing && <p className="mt-1.5 mb-0 text-xs text-destructive">شماره سریال را وارد کنید.</p>}
          </div>
        </section>

        <section className="flex flex-col gap-3.5 rounded-xl border border-border bg-card p-4">
          <span className="text-sm font-semibold">باتری کهنه تحویل گرفته شد؟</span>
          <div role="radiogroup" aria-label="باتری کهنه" className="grid grid-cols-2 gap-2">
            <Segment on={core} onClick={() => { setCore(true); setReceivedRial(null); }}>
              بله
            </Segment>
            <Segment on={!core} onClick={() => { setCore(false); setReceivedRial(null); }}>
              خیر
            </Segment>
          </div>
          {core && (
            <div>
              <label htmlFor="ah" className="mb-2 block text-sm font-semibold">
                آمپر باتری کهنه (از روی برچسب)
              </label>
              <div className="flex items-center gap-2">
                <button type="button" className="size-[52px] shrink-0 rounded-touch border border-input bg-card text-[22px] font-bold" aria-label="کم کردن" onClick={() => setAhClamped(ah - 1)}>
                  −
                </button>
                <Input
                  id="ah"
                  inputMode="numeric"
                  value={faDigits(ah)}
                  aria-invalid={!ahValid}
                  onChange={(e) => setAhClamped(parseFaInt(e.target.value) ?? 0)}
                  className="h-[52px] rounded-touch text-center text-[22px] font-extrabold"
                />
                <button type="button" className="size-[52px] shrink-0 rounded-touch border border-input bg-card text-[22px] font-bold" aria-label="زیاد کردن" onClick={() => setAhClamped(ah + 1)}>
                  +
                </button>
              </div>
              {ahValid ? (
                s && (
                  <div className="mt-2 text-[13px] text-muted-foreground">
                    اعتبار: {faNumber(ah)} آمپر × {toman(settings.coreCreditPerAhRial)} = <strong>{toman(s.coreCreditRial)} تومان</strong>
                  </div>
                )
              ) : (
                <p className="mt-2 mb-0 text-xs text-destructive">
                  عدد بین {faNumber(settings.coreAhMin)} تا {faNumber(settings.coreAhMax)} وارد کنید.
                </p>
              )}
            </div>
          )}
        </section>

        <section aria-live="polite" className="flex flex-col gap-2.5 rounded-sheet bg-foreground px-4 py-[18px] text-white">
          {quote.isError ? (
            <p className="m-0 text-sm">{quote.error.message}</p>
          ) : !s ? (
            <Skeleton className="h-24 bg-slate-700" />
          ) : (
            <>
              <div className="flex justify-between text-[13px] text-slate-300">
                <span>قیمت باتری</span>
                <span>{toman(s.batteryPriceRial)}</span>
              </div>
              <div className="flex justify-between text-[13px] text-slate-300">
                <span>اعتبار باتری کهنه</span>
                <span dir="ltr">−{toman(s.coreCreditRial)}</span>
              </div>
              <div className="h-px bg-slate-700" />
              <div className="text-[13px] text-slate-300">قابل پرداخت</div>
              <div className={cn('text-[34px] leading-tight font-extrabold', quote.isFetching && 'opacity-60')}>
                {toman(s.totalRial)} <span className="text-sm font-medium text-slate-300">تومان</span>
              </div>
              <div className="rounded-control bg-slate-800 px-2.5 py-2 text-[13px] text-border">{deltaText}</div>
            </>
          )}
        </section>

        <section className="flex flex-col gap-3.5 rounded-xl border border-border bg-card p-4">
          <div>
            <label htmlFor="recv" className="mb-2 block text-sm font-semibold">
              مبلغ دریافتی (تومان)
            </label>
            <Input
              id="recv"
              inputMode="numeric"
              value={received ? toman(received) : ''}
              onChange={(e) => setReceivedRial(tomanInputToRial(e.target.value) ?? '0')}
              className="h-[52px] rounded-touch text-xl font-extrabold"
            />
            {payable && received && (
              <div className={cn('mt-2 text-[13px] font-semibold', diff === 0n ? 'text-success' : 'text-destructive')}>
                {diff === 0n
                  ? 'برابر با مبلغ قابل پرداخت'
                  : `مغایرت: ${toman((diff < 0n ? -diff : diff).toString())} تومان ${diff > 0n ? 'کمتر' : 'بیشتر'} — برای مدیر شعبه ثبت می‌شود.`}
              </div>
            )}
          </div>
          <div>
            <span className="mb-2 block text-sm font-semibold">روش پرداخت</span>
            <div role="radiogroup" aria-label="روش پرداخت" className="grid grid-cols-3 gap-2">
              {ON_SITE_PAYMENT_METHODS.map((m) => (
                <Segment key={m} on={method === m} onClick={() => setMethod(m)} className="text-[13px]">
                  {PAYMENT_METHOD_LABELS[m]}
                </Segment>
              ))}
            </div>
          </div>
          {method === 'CARD_TO_CARD' && (
            <div>
              <label htmlFor="ref" className="mb-2 block text-sm font-semibold">
                کد پیگیری انتقال
              </label>
              <Input id="ref" dir="ltr" placeholder="مثلاً 482910" value={reference} onChange={(e) => setReference(e.target.value)} className="h-[52px] rounded-touch" />
            </div>
          )}
          <div>
            <label htmlFor="note" className="mb-2 block text-sm font-semibold">
              یادداشت <span className="font-normal text-subtle-foreground">(اختیاری)</span>
            </label>
            <Textarea id="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} className="rounded-touch text-[15px]" />
          </div>
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 mx-auto flex max-w-[480px] flex-col gap-2 border-t border-border bg-card px-4 pt-3 pb-6">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">قابل پرداخت</span>
          <span className="font-extrabold">{payable ? `${toman(payable)} تومان` : '—'}</span>
        </div>
        <Button variant="primary" size="touch" onClick={submit} disabled={finish.isPending}>
          {finish.isPending && <Loader2 className="animate-spin" aria-hidden />}
          ثبت پایان و تسویه
        </Button>
      </div>
    </div>
  );
}

function Segment({ on, className, ...props }: React.ComponentProps<'button'> & { on: boolean }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      className={cn(
        'h-12 rounded-touch border bg-card text-sm font-semibold text-slate-700',
        on ? 'border-2 border-foreground font-extrabold text-foreground' : 'border-border',
        className,
      )}
      {...props}
    />
  );
}

function FinishSkeleton() {
  return (
    <div role="status" aria-label="در حال بارگذاری فرم" className="flex flex-col gap-3 p-4 pt-20">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-12 w-full" />
        </div>
      ))}
    </div>
  );
}
