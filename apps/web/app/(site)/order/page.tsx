'use client';

import type { VehicleType } from '@amprex/shared';
import { Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect } from 'react';
import { StepBattery } from '@/components/order/step-battery';
import { StepContact } from '@/components/order/step-contact';
import { StepReview } from '@/components/order/step-review';
import { StepSlot } from '@/components/order/step-slot';
import { StepVehicle } from '@/components/order/step-vehicle';
import { type OrderDraft, useOrderDraft } from '@/lib/order-draft';
import { useHydrated } from '@/lib/use-session';

export default function OrderPage() {
  return (
    <Suspense fallback={<Loading />}>
      <OrderFlow />
    </Suspense>
  );
}

function Loading() {
  return (
    <div className="flex min-h-dvh items-center justify-center" role="status" aria-label="در حال بارگذاری">
      <Loader2 className="size-6 animate-spin text-subtle-foreground" aria-hidden />
    </div>
  );
}

/** First step whose inputs are still missing. */
function firstIncomplete(d: OrderDraft): number {
  if (!d.vehicleModelId) return 1;
  if (!d.batteryId) return 2;
  if (!d.customerName || !d.customerPhone || !d.district || !d.address) return 3;
  if (!d.scheduledDate || !d.slotId) return 4;
  return 5;
}

/** The step lives in the URL (?step=N), so the browser back button walks the flow. */
function OrderFlow() {
  const params = useSearchParams();
  const router = useRouter();
  const ready = useHydrated();
  const { draft, update } = useOrderDraft();
  const wanted = Math.min(5, Math.max(1, Number(params.get('step') ?? 1)));
  const step = Math.min(wanted, firstIncomplete(draft));

  // Entry links: ?type=MOTORCYCLE from the site menu, ?channel=PHONE from the admin panel.
  useEffect(() => {
    const type = params.get('type') as VehicleType | null;
    const channel = params.get('channel');
    if (type && type !== draft.vehicleType) update({ vehicleType: type, brand: undefined, vehicleModelId: undefined, batteryId: undefined });
    if (channel && channel !== draft.channelCode) update({ channelCode: channel });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const goTo = useCallback((n: number) => router.push(`/order?step=${n}`), [router]);
  const back = useCallback(() => (step === 1 ? router.push(draft.channelCode ? '/admin/orders' : '/') : router.back()), [router, step, draft.channelCode]);

  if (!ready) return <Loading />;
  const common = { draft, update, onBack: back };
  switch (step) {
    case 1:
      return <StepVehicle {...common} onNext={() => goTo(2)} />;
    case 2:
      return <StepBattery {...common} onNext={() => goTo(3)} onChangeVehicle={() => goTo(1)} />;
    case 3:
      return <StepContact {...common} onNext={() => goTo(4)} onChangeBattery={() => goTo(2)} />;
    case 4:
      return <StepSlot {...common} onNext={() => goTo(5)} />;
    default:
      return <StepReview {...common} goTo={goTo} />;
  }
}
