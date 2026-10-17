'use client';

import { VEHICLE_TYPE_LABELS, type VehicleType } from '@amprex/shared';
import { ArrowLeft, Bike, Car } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useOrderDraft } from '@/lib/order-draft';
import { useBrands, useVehicles } from '@/lib/queries';
import { cn } from '@/lib/utils';

const TYPE_ICON = { CAR: Car, MOTORCYCLE: Bike } as const;

/** Home hero card: type / brand / model, then straight to the compatible batteries step. */
export function QuickVehiclePicker() {
  const router = useRouter();
  const { draft, reset } = useOrderDraft();
  const [type, setType] = useState<VehicleType>(draft.vehicleType);
  const [brand, setBrand] = useState<string | undefined>(draft.vehicleType === type ? draft.brand : undefined);
  const [model, setModel] = useState<string | undefined>(draft.vehicleModelId);
  const brands = useBrands();
  const vehicles = useVehicles(type, brand);
  const typeBrands = brands.data?.filter((b) => b.type === type) ?? [];

  const go = () => {
    // A new vehicle starts a new checkout.
    reset({ vehicleType: type, brand, vehicleModelId: model });
    router.push('/order?step=2');
  };

  return (
    <div className="flex w-full max-w-[480px] min-w-0 flex-[1_1_400px] flex-col gap-[18px] rounded-card border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,.04),0_16px_40px_rgba(15,23,42,.08)] md:p-7">
      <div className="text-lg font-extrabold">باتری سازگار با وسیله شما</div>
      <div role="radiogroup" aria-label="نوع وسیله" className="grid grid-cols-2 gap-1 rounded-touch bg-muted p-1">
        {(['CAR', 'MOTORCYCLE'] as const).map((t) => {
          const Icon = TYPE_ICON[t];
          const on = t === type;
          return (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                setType(t);
                setBrand(undefined);
                setModel(undefined);
              }}
              className={cn(
                'flex h-[46px] items-center justify-center gap-2 rounded-control text-sm font-semibold',
                on ? 'bg-card text-foreground shadow-[0_1px_2px_rgba(15,23,42,.12)]' : 'text-muted-foreground',
              )}
            >
              <Icon className="size-[18px]" aria-hidden />
              {VEHICLE_TYPE_LABELS[t]}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label id="brand-label" className="mb-1.5 block text-[13px] font-semibold">
            برند
          </label>
          <Select
            dir="rtl"
            value={brand ?? ''}
            onValueChange={(v) => {
              setBrand(v);
              setModel(undefined);
            }}
          >
            <SelectTrigger aria-labelledby="brand-label" className="h-11 w-full text-[15px]">
              <SelectValue placeholder="انتخاب کنید" />
            </SelectTrigger>
            <SelectContent>
              {typeBrands.map((b) => (
                <SelectItem key={b.brandFa} value={b.brandFa}>
                  {b.brandFa}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label id="model-label" className="mb-1.5 block text-[13px] font-semibold">
            مدل
          </label>
          <Select dir="rtl" value={model ?? ''} onValueChange={setModel} disabled={!brand}>
            <SelectTrigger aria-labelledby="model-label" className="h-11 w-full text-[15px]">
              <SelectValue placeholder="انتخاب کنید" />
            </SelectTrigger>
            <SelectContent>
              {vehicles.data?.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.nameFa}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button variant="primary" size="lg" className="w-full" disabled={!model} onClick={go}>
        نمایش باتری‌های سازگار
        <ArrowLeft aria-hidden />
      </Button>
      <p className="m-0 text-center text-[13px] text-subtle-foreground">بدون ثبت‌نام · پرداخت در محل، پس از نصب</p>
    </div>
  );
}
