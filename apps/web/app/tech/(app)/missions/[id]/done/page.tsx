'use client';

import { ACTIVE_MISSION_STATUSES, PAYMENT_METHOD_LABELS } from '@amprex/shared';
import { CircleCheck, Info } from 'lucide-react';
import Link from 'next/link';
import { use } from 'react';
import { ErrorState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { faNumber, slotRange, toman } from '@/lib/format';
import { useMissions, useOrder } from '@/lib/queries';

export default function MissionDonePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const order = useOrder(id);
  const missions = useMissions('today');
  const next = missions.data?.find((m) => m.id !== id && ACTIVE_MISSION_STATUSES.includes(m.status));

  if (order.isPending) {
    return (
      <div role="status" aria-label="در حال بارگذاری" className="flex flex-col items-center gap-4 px-4 pt-12">
        <Skeleton className="size-[72px] rounded-full" />
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-48 w-full rounded-sheet" />
      </div>
    );
  }
  if (order.isError) {
    return <ErrorState error={order.error} title="بارگذاری مأموریت ناموفق بود" onRetry={() => order.refetch()} />;
  }

  const o = order.data;
  const payment = o.payments.at(-1);
  const core = o.coreReturn;

  return (
    <main className="flex min-h-dvh flex-col gap-5 px-4 pt-12 pb-7">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-[72px] items-center justify-center rounded-full border border-success-border bg-success-muted text-success">
          <CircleCheck className="size-9" aria-hidden />
        </span>
        <h1 className="m-0 text-[22px] font-extrabold">مأموریت ثبت شد</h1>
      </div>

      <section className="rounded-sheet border border-border bg-card px-4 py-1">
        <Row label="سفارش">
          <span className="ltr-code text-[13px]">{o.code}</span>
        </Row>
        <Row label="باتری نصب‌شده">{o.battery.nameFa}</Row>
        <Row label="باتری کهنه">
          {core?.returned ? `تحویل شد · ${faNumber(core.ampereHours ?? 0)} آمپر` : 'تحویل نشد'}
        </Row>
        <Row label="دریافتی">{payment ? `${toman(payment.amountRial)} تومان` : '—'}</Row>
        <Row label="روش" last>
          {payment ? PAYMENT_METHOD_LABELS[payment.method] : '—'}
        </Row>
      </section>

      {core?.returned && (
        <div className="flex gap-2.5 rounded-xl bg-muted px-3.5 py-3 text-[13px] leading-7 text-slate-700">
          <Info className="mt-1 size-[18px] shrink-0" aria-hidden />
          <span>باتری کهنه را تا پایان روز به انبار {o.branch.name} تحویل دهید.</span>
        </div>
      )}

      <div className="mt-auto flex flex-col gap-2.5">
        {next && (
          <div className="text-center text-[13px] text-muted-foreground">
            مأموریت بعدی: {slotRange(next.slot.startTime, next.slot.endTime)} · منطقه {faNumber(next.district)}
          </div>
        )}
        <Button asChild variant="primary" size="touch">
          <Link href="/tech">بازگشت به مأموریت‌ها</Link>
        </Button>
      </div>
    </main>
  );
}

function Row({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 py-3 text-sm ${last ? '' : 'border-b border-muted'}`}>
      <span className="text-subtle-foreground">{label}</span>
      <span>{children}</span>
    </div>
  );
}
