'use client';

import { INSTALL_LOCATION_LABELS, TECH_STATUS_LABELS, type OrderStatus } from '@amprex/shared';
import { Battery, Info, MapPin, Navigation, Phone } from 'lucide-react';
import Link from 'next/link';
import { use } from 'react';
import { toast } from 'sonner';
import { ErrorState } from '@/components/states';
import { BackHeader } from '@/components/tech/back-header';
import { Stepper } from '@/components/stepper';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { faDigits, faNumber, slotRange, toman } from '@/lib/format';
import { useOrder, useOrderMutation } from '@/lib/queries';
import type { OrderDetail } from '@/lib/types';

const STEP_LABELS = ['پذیرش', 'حرکت', 'رسیدم', 'شروع کار', 'ثبت پایان'] as const;
/** Status → (current step, the API step that moves it on, button text). */
const FLOW: Partial<Record<OrderStatus, { index: number; step?: 'accept' | 'depart' | 'arrive' | 'start'; next: OrderStatus; action: string }>> = {
  ASSIGNED: { index: 0, step: 'accept', next: 'ACCEPTED', action: 'پذیرش مأموریت' },
  ACCEPTED: { index: 1, step: 'depart', next: 'EN_ROUTE', action: 'حرکت به سمت مشتری' },
  EN_ROUTE: { index: 2, step: 'arrive', next: 'ON_SITE', action: 'رسیدم' },
  ON_SITE: { index: 3, step: 'start', next: 'INSTALLING', action: 'شروع کار' },
  INSTALLING: { index: 4, next: 'COMPLETED', action: 'ثبت پایان کار' },
};

export default function MissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const order = useOrder(id);

  if (order.isPending) return <DetailSkeleton />;
  if (order.isError) {
    return (
      <div className="flex min-h-dvh flex-col">
        <BackHeader title="مأموریت" />
        <ErrorState error={order.error} title="بارگذاری مأموریت ناموفق بود" onRetry={() => order.refetch()} retrying={order.isFetching} />
      </div>
    );
  }
  return <MissionDetail order={order.data} />;
}

function MissionDetail({ order }: { order: OrderDetail }) {
  const flow = FLOW[order.status];
  const advance = useOrderMutation(order.id, (step: string) => api<OrderDetail>(`/missions/${order.id}/${step}`, { method: 'POST' }));
  const canAdvance = flow ? order.allowedTransitions.includes(flow.next) : false;
  const mapsHref =
    order.latitude && order.longitude
      ? `https://www.google.com/maps/search/?api=1&query=${order.latitude},${order.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`تهران ${order.address}`)}`;

  return (
    <div className="relative flex min-h-dvh flex-col">
      <BackHeader
        title={`ساعت ${slotRange(order.slot.startTime, order.slot.endTime)}`}
        code={order.code}
        status={TECH_STATUS_LABELS[order.status]}
      />

      {flow && (
        <nav aria-label="مراحل مأموریت" className="border-b border-border bg-card px-3 pt-3.5 pb-4">
          <Stepper labels={STEP_LABELS} current={flow.index} label="مراحل مأموریت" />
        </nav>
      )}

      <main className="flex flex-col gap-3 p-4 pb-36">
        <section className="flex flex-col gap-3.5 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-subtle-foreground">مشتری</div>
              <div className="text-[17px] font-extrabold">{order.customer.fullName}</div>
            </div>
            <Button asChild variant="outline" className="h-12 border-foreground">
              <a href={`tel:${order.customer.phone}`}>
                <Phone aria-hidden />
                تماس
              </a>
            </Button>
          </div>
          <div className="h-px bg-muted" />
          <div className="flex items-start gap-2.5">
            <MapPin className="mt-1 size-[18px] shrink-0 text-muted-foreground" aria-hidden />
            <div className="flex-1 text-[15px] leading-8">
              منطقه {faNumber(order.district)} — {faDigits(order.address)}
              <div className="text-[13px] text-muted-foreground">محل نصب: {INSTALL_LOCATION_LABELS[order.installLocation]}</div>
            </div>
          </div>
          <Button asChild variant="outline" className="w-full">
            <a href={mapsHref} target="_blank" rel="noreferrer">
              <Navigation aria-hidden />
              مسیریابی
            </a>
          </Button>
          {order.branchNote && <NoteBox label="یادداشت شعبه:" text={order.branchNote} />}
          {order.customerNote && <NoteBox label="توضیح مشتری:" text={order.customerNote} />}
        </section>

        <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-subtle-foreground">باتری برای نصب</div>
          <div className="flex items-center gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted">
              <Battery className="size-6" aria-hidden />
            </span>
            <div>
              <div className="text-[17px] font-extrabold">{order.battery.nameFa}</div>
              <div className="text-[13px] text-muted-foreground">
                CCA {faNumber(order.battery.coldCrankingA)} · گارانتی {faNumber(order.battery.warrantyMonths)} ماه · {order.vehicleModel.nameFa}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[13px]">
            <div className="rounded-control bg-background p-2.5">
              <div className="text-xs text-subtle-foreground">برداشت از</div>
              <div className="font-bold">{order.branch.name}</div>
            </div>
            <div className="rounded-control bg-background p-2.5">
              <div className="text-xs text-subtle-foreground">{order.status === 'COMPLETED' ? 'مبلغ نهایی' : 'مبلغ برآوردی'}</div>
              <div className="font-bold">{toman(order.totalRial)} تومان</div>
            </div>
          </div>
          {order.status !== 'COMPLETED' && order.estimatedCoreAh && (
            <div className="text-[13px] leading-7 text-muted-foreground">
              برآورد با فرض باتری کهنه {faNumber(order.estimatedCoreAh)} آمپر است؛ مبلغ نهایی در فرم پایان محاسبه می‌شود.
            </div>
          )}
        </section>
      </main>

      {flow && canAdvance && (
        <div className="fixed inset-x-0 bottom-0 mx-auto flex max-w-[480px] flex-col gap-2 border-t border-border bg-card px-4 pt-3 pb-6">
          {flow.step ? (
            <Button
              variant="primary"
              size="touch"
              disabled={advance.isPending}
              onClick={() => advance.mutate(flow.step!, { onError: (e) => toast.error(e.message) })}
            >
              {flow.action}
            </Button>
          ) : (
            <Button asChild variant="primary" size="touch">
              <Link href={`/tech/missions/${order.id}/finish`}>{flow.action}</Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function NoteBox({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex gap-2.5 rounded-touch bg-muted p-3 text-sm leading-7">
      <Info className="mt-1 size-[18px] shrink-0 text-slate-700" aria-hidden />
      <span>
        <strong>{label}</strong> {text}
      </span>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div role="status" aria-label="در حال بارگذاری مأموریت" className="flex flex-col">
      <div className="flex h-[60px] items-center gap-3 border-b border-border bg-card px-4">
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="h-[86px] border-b border-border bg-card" />
      <div className="flex flex-col gap-3 p-4">
        {[0, 1].map((i) => (
          <div key={i} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
