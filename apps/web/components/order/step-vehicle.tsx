'use client';

import { VEHICLE_TYPE_LABELS, type VehicleType } from '@amprex/shared';
import { Bike, Car, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { EmptyState, ErrorState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import type { OrderDraft } from '@/lib/order-draft';
import { useBrands, useVehicles } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { Opt, RadioDot, StepShell } from './shared';

const TYPE_ICON = { CAR: Car, MOTORCYCLE: Bike } as const;
const SHOWN_BRANDS = 6;

/** Step 1 «نوع وسیله نقلیه»: type, brand, model. */
export function StepVehicle({ draft, update, onNext, onBack }: { draft: OrderDraft; update: (p: Partial<OrderDraft>) => void; onNext: () => void; onBack: () => void }) {
  const brands = useBrands();
  const [allBrands, setAllBrands] = useState(false);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const typeBrands = brands.data?.filter((b) => b.type === draft.vehicleType) ?? [];
  const brand = draft.brand ?? typeBrands[0]?.brandFa;
  const vehicles = useVehicles(draft.vehicleType, q ? undefined : brand, q || undefined);

  const pickType = (t: VehicleType) => update({ vehicleType: t, brand: undefined, vehicleModelId: undefined, batteryId: undefined });

  return (
    <StepShell
      step={1}
      onBack={onBack}
      bottom={
        <Button variant="primary" size="lg" className="w-full" disabled={!draft.vehicleModelId} onClick={onNext}>
          ادامه: انتخاب باتری
        </Button>
      }
    >
      <section className="flex flex-col gap-2.5">
        <h1 className="m-0 text-lg font-extrabold">نوع وسیله نقلیه</h1>
        <div className="grid grid-cols-2 gap-2.5">
          {(['CAR', 'MOTORCYCLE'] as const).map((t) => {
            const Icon = TYPE_ICON[t];
            const on = draft.vehicleType === t;
            return (
              <Opt key={t} on={on} aria-pressed={on} onClick={() => pickType(t)} className={cn('h-24 flex-col justify-center gap-1.5', !on && 'text-muted-foreground')}>
                <Icon className="size-7" aria-hidden />
                {VEHICLE_TYPE_LABELS[t]}
              </Opt>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-2.5">
        <h2 className="m-0 text-base font-bold">برند</h2>
        {brands.isPending ? (
          <div className="grid grid-cols-3 gap-2" role="status" aria-label="در حال بارگذاری برندها">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[52px] rounded-touch" />
            ))}
          </div>
        ) : brands.isError ? (
          <ErrorState error={brands.error} title="بارگذاری برندها ناموفق بود" onRetry={() => brands.refetch()} className="py-6" />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              {(allBrands ? typeBrands : typeBrands.slice(0, SHOWN_BRANDS)).map((b) => (
                <Opt
                  key={b.brandFa}
                  on={!q && b.brandFa === brand}
                  className="justify-center text-[13px]"
                  onClick={() => {
                    setSearch('');
                    update({ brand: b.brandFa, vehicleModelId: undefined, batteryId: undefined });
                  }}
                >
                  {b.brandFa}
                </Opt>
              ))}
            </div>
            {!allBrands && typeBrands.length > SHOWN_BRANDS && (
              <Button variant="link" className="h-8 self-start px-1 text-sm font-semibold" onClick={() => setAllBrands(true)}>
                همه برندها
              </Button>
            )}
          </>
        )}
      </section>

      <section className="flex flex-col gap-2.5">
        <h2 className="m-0 text-base font-bold">مدل</h2>
        <div className="relative">
          <label htmlFor="q" className="sr-only">
            جستجوی مدل
          </label>
          <Input id="q" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جستجوی مدل، مثلاً ۲۰۶" className="ps-10" />
          <Search className="pointer-events-none absolute top-3 right-3 size-[18px] text-subtle-foreground" aria-hidden />
        </div>
        <div role="radiogroup" aria-label="مدل" className="flex flex-col gap-2">
          {vehicles.isPending &&
            [0, 1, 2].map((i) => <Skeleton key={i} role="status" aria-label="در حال بارگذاری مدل‌ها" className="h-[52px] rounded-touch" />)}
          {vehicles.isError && <ErrorState error={vehicles.error} title="بارگذاری مدل‌ها ناموفق بود" onRetry={() => vehicles.refetch()} className="py-6" />}
          {vehicles.isSuccess && vehicles.data.length === 0 && (
            <EmptyState icon={Search} title="مدلی پیدا نشد" description="جستجو را کوتاه‌تر کنید یا برند دیگری انتخاب کنید." className="py-6" />
          )}
          {vehicles.data?.map((v) => {
            const on = v.id === draft.vehicleModelId;
            return (
              <Opt
                key={v.id}
                role="radio"
                aria-checked={on}
                on={on}
                onClick={() => update({ brand: v.brandFa, vehicleModelId: v.id, batteryId: undefined })}
              >
                <span>{v.nameFa}</span>
                <RadioDot on={on} />
              </Opt>
            );
          })}
        </div>
      </section>
    </StepShell>
  );
}
