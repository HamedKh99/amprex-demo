'use client';

import { VEHICLE_TYPE_LABELS } from '@amprex/shared';
import { Battery, Bike, Car, Headset, WifiOff } from 'lucide-react';
import { useState } from 'react';
import { ErrorState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiRequestError } from '@/lib/api';
import { faNumber, toman } from '@/lib/format';
import type { OrderDraft } from '@/lib/order-draft';
import { useCompatible, useSettings } from '@/lib/queries';
import type { CompatibleBattery } from '@/lib/types';
import { cn } from '@/lib/utils';
import { StepShell } from './shared';

type Sort = 'recommended' | 'cheapest' | 'warranty' | 'ah';
const SORTS: { key: Sort; label: string }[] = [
  { key: 'recommended', label: 'پیشنهادی' },
  { key: 'cheapest', label: 'ارزان‌ترین' },
  { key: 'warranty', label: 'گارانتی بیشتر' },
  { key: 'ah', label: 'آمپر بالاتر' },
];
// Display order only; prices and availability come from the API as-is.
const BY: Record<Sort, (a: CompatibleBattery, b: CompatibleBattery) => number> = {
  recommended: () => 0,
  cheapest: (a, b) => Number(BigInt(a.priceRial) - BigInt(b.priceRial)),
  warranty: (a, b) => b.warrantyMonths - a.warrantyMonths,
  ah: (a, b) => b.capacityAh - a.capacityAh,
};

/** Step 2 «باتری سازگار»: factory-spec batteries first, then alternatives; only those in stock. */
export function StepBattery({
  draft,
  update,
  onNext,
  onBack,
  onChangeVehicle,
}: {
  draft: OrderDraft;
  update: (p: Partial<OrderDraft>) => void;
  onNext: () => void;
  onBack: () => void;
  onChangeVehicle: () => void;
}) {
  // Before the address step: stock at any branch; after it: at the branch serving the district.
  const fit = useCompatible(draft.vehicleModelId, draft.district);
  const settings = useSettings();
  const [sort, setSort] = useState<Sort>('recommended');
  const all = fit.data?.batteries.filter((b) => b.inStock) ?? [];
  const primary = [...all.filter((b) => b.matchesFactorySpec)].sort(BY[sort]);
  const alts = [...all.filter((b) => !b.matchesFactorySpec)].sort(BY[sort]);
  const chosen = all.find((b) => b.id === draft.batteryId);
  const v = fit.data?.vehicle;
  const VehicleIcon = v?.type === 'MOTORCYCLE' ? Bike : Car;
  const offline = fit.error instanceof ApiRequestError && fit.error.status === 0;

  return (
    <StepShell
      step={2}
      onBack={onBack}
      bottom={
        <div className="flex items-center gap-3">
          {chosen && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">{chosen.nameFa}</div>
              <div className="text-xs text-subtle-foreground">{toman(chosen.priceRial)} تومان</div>
            </div>
          )}
          <Button variant="primary" size="lg" className={cn(!chosen && 'w-full')} disabled={!chosen} onClick={onNext}>
            ادامه
          </Button>
        </div>
      }
    >
      {offline && (
        <div role="status" className="flex items-center gap-2 rounded-control bg-foreground px-3 py-2.5 text-[13px] text-white">
          <WifiOff className="size-4" aria-hidden />
          اتصال به اینترنت قطع است.
        </div>
      )}

      <div className="flex items-center justify-between rounded-card border border-border bg-card px-3.5 py-3">
        <div className="flex items-center gap-2.5">
          <VehicleIcon className="size-[22px] text-slate-700" aria-hidden />
          {v ? (
            <div>
              <div className="text-sm font-bold">{v.nameFa}</div>
              <div className="text-xs text-subtle-foreground">
                {v.brandFa} · {VEHICLE_TYPE_LABELS[v.type]}
              </div>
            </div>
          ) : (
            <Skeleton className="h-8 w-32" />
          )}
        </div>
        <Button variant="link" className="text-[13px] font-semibold" onClick={onChangeVehicle}>
          تغییر
        </Button>
      </div>

      {fit.isPending && (
        <div role="status" aria-label="در حال یافتن باتری‌های سازگار" className="flex flex-col gap-2.5">
          <span className="text-[13px] text-subtle-foreground">در حال یافتن باتری‌های سازگار</span>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-3 rounded-card border border-border bg-card p-3.5">
              <div className="flex items-center gap-3">
                <Skeleton className="size-11 rounded-touch" />
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <Skeleton className="h-14 w-full rounded-control" />
              <Skeleton className="h-6 w-32" />
            </div>
          ))}
        </div>
      )}

      {fit.isError && (
        <ErrorState
          error={fit.error}
          title="فهرست باتری‌ها بارگذاری نشد"
          description="اتصال اینترنت را بررسی کنید و دوباره تلاش کنید. انتخاب‌های قبلی شما ذخیره شده است."
          onRetry={() => fit.refetch()}
          retrying={fit.isFetching}
        />
      )}

      {fit.isSuccess && all.length === 0 && (
        <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
          <span className="flex size-[52px] items-center justify-center rounded-card bg-muted text-muted-foreground">
            <Battery className="size-6" aria-hidden />
          </span>
          <h2 className="m-0 text-base font-extrabold">باتری سازگاری موجود نیست</h2>
          <p className="m-0 max-w-sm text-[13px] leading-7 text-muted-foreground">
            برای این مدل فعلاً باتری سازگار در انبار نداریم.
          </p>
          {settings.data && (
            <Button asChild size="lg" className="w-full max-w-xs">
              <a href={`tel:${settings.data.supportPhone}`}>
                <Headset aria-hidden />
                تماس با پشتیبانی
              </a>
            </Button>
          )}
        </div>
      )}

      {all.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <h1 className="m-0 text-lg font-extrabold">{faNumber(all.length)} باتری سازگار</h1>
            <span className="text-xs text-subtle-foreground">قیمت‌ها به تومان</span>
          </div>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
            {SORTS.map((s) => (
              <button
                key={s.key}
                type="button"
                aria-pressed={sort === s.key}
                onClick={() => setSort(s.key)}
                className={cn(
                  'h-[34px] shrink-0 rounded-full border px-3 text-[13px] font-medium whitespace-nowrap',
                  sort === s.key ? 'border-foreground bg-foreground text-white' : 'border-border bg-card text-slate-700',
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          {primary.length > 0 && (
            <section className="flex flex-col gap-2.5">
              <h2 className="m-0 text-[13px] font-bold text-muted-foreground">مطابق مشخصات کارخانه</h2>
              {primary.map((b) => (
                <BatteryCard key={b.id} b={b} recommended chosen={b.id === draft.batteryId} onPick={() => update({ batteryId: b.id })} />
              ))}
            </section>
          )}
          {alts.length > 0 && (
            <section className="flex flex-col gap-2.5">
              <div>
                <h2 className="m-0 text-[13px] font-bold text-muted-foreground">جایگزین‌ها</h2>
                <p className="mt-0.5 mb-0 text-xs leading-[1.8] text-subtle-foreground">ابعاد و قطب یکسان؛ آمپر متفاوت با مشخصات کارخانه.</p>
              </div>
              {alts.map((b) => (
                <BatteryCard key={b.id} b={b} chosen={b.id === draft.batteryId} onPick={() => update({ batteryId: b.id })} />
              ))}
            </section>
          )}
        </>
      )}
    </StepShell>
  );
}

function BatteryCard({ b, recommended, chosen, onPick }: { b: CompatibleBattery; recommended?: boolean; chosen: boolean; onPick: () => void }) {
  return (
    <article className={cn('flex flex-col gap-3 rounded-card bg-card', chosen ? 'border-2 border-foreground p-[13px]' : 'border border-border p-3.5')}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-touch bg-muted text-slate-700">
            <Battery className="size-[22px]" aria-hidden />
          </span>
          <div>
            <div className="text-[15px] font-bold">{b.brand}</div>
            <div className="text-xs text-subtle-foreground">{b.series}</div>
          </div>
        </div>
        {recommended ? <Badge variant="dark">پیشنهادی</Badge> : <Badge variant="outline">جایگزین</Badge>}
      </div>
      <dl className="m-0 grid grid-cols-3 gap-2 rounded-control bg-background p-2.5">
        <div>
          <dt className="text-[11px] text-subtle-foreground">ظرفیت</dt>
          <dd className="m-0 text-sm font-bold">{faNumber(b.capacityAh)} آمپر</dd>
        </div>
        <div>
          <dt className="text-[11px] text-subtle-foreground">CCA</dt>
          <dd className="m-0 text-sm font-bold">{faNumber(b.coldCrankingA)}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-subtle-foreground">گارانتی</dt>
          <dd className="m-0 text-sm font-bold">{faNumber(b.warrantyMonths)} ماه</dd>
        </div>
      </dl>
      <div className="flex items-center justify-between">
        <div>
          <span className="text-lg font-extrabold">{toman(b.priceRial)}</span> <span className="text-xs text-subtle-foreground">تومان</span>
        </div>
        <Button aria-pressed={chosen} variant={chosen ? 'dark' : 'outline'} onClick={onPick}>
          {chosen ? '✓ انتخاب شد' : 'انتخاب'}
        </Button>
      </div>
    </article>
  );
}
