'use client';

import { INSTALL_LOCATIONS, INSTALL_LOCATION_LABELS, TEHRAN_DISTRICTS } from '@amprex/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { faDigits } from '@/lib/format';
import type { OrderDraft } from '@/lib/order-draft';
import { mobile } from '@/lib/schemas';
import type { CompatibleBatteries } from '@/lib/types';
import { cn } from '@/lib/utils';
import { FieldError, StepShell } from './shared';

const schema = z.object({
  customerName: z.string().trim().min(3, 'نام و نام خانوادگی را وارد کنید.').max(80),
  customerPhone: mobile,
  district: z.number({ error: 'منطقه را انتخاب کنید.' }).int().min(1).max(22),
  address: z.string().trim().min(10, 'آدرس کامل را وارد کنید (حداقل ۱۰ نویسه).').max(300),
  installLocation: z.enum(INSTALL_LOCATIONS),
  customerNote: z.string().trim().max(500).optional(),
});
type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

const districtLabel = (d: number) => {
  const n = TEHRAN_DISTRICTS.find((x) => x.district === d);
  return `منطقه ${faDigits(d)}${n ? ` — ${n.neighbourhoods}` : ''}`;
};

/** Step 3 «اطلاعات تماس و آدرس». Re-checks the chosen battery at the branch serving the district. */
export function StepContact({
  draft,
  update,
  onNext,
  onBack,
  onChangeBattery,
}: {
  draft: OrderDraft;
  update: (p: Partial<OrderDraft>) => void;
  onNext: () => void;
  onBack: () => void;
  onChangeBattery: () => void;
}) {
  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      customerName: draft.customerName ?? '',
      customerPhone: draft.customerPhone ?? '',
      district: draft.district,
      address: draft.address ?? '',
      installLocation: draft.installLocation,
      customerNote: draft.customerNote ?? '',
    },
  });
  const { errors, isSubmitting } = form.formState;
  const [problem, setProblem] = useState<string | null>(null);

  const submit = form.handleSubmit(async (v) => {
    setProblem(null);
    // A new district can mean a new branch and new slots: keep the slot only if the district is unchanged.
    update({ ...v, ...(v.district !== draft.district && { scheduledDate: undefined, slotId: undefined }) });
    try {
      const fit = await api<CompatibleBatteries>(`/catalog/vehicles/${draft.vehicleModelId}/batteries`, {
        query: { district: v.district },
        auth: false,
      });
      const ok = fit.batteries.find((b) => b.id === draft.batteryId)?.inStock;
      if (!ok) {
        setProblem('این باتری در حال حاضر در شعبه منطقه شما موجود نیست.');
        return;
      }
      onNext();
    } catch (e) {
      setProblem((e as Error).message);
    }
  });

  return (
    <StepShell
      step={3}
      onBack={onBack}
      bottom={
        <Button variant="primary" size="lg" className="w-full" disabled={isSubmitting} onClick={submit}>
          ادامه: زمان نصب
        </Button>
      }
    >
      <h1 className="m-0 text-lg font-extrabold">اطلاعات تماس و آدرس</h1>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4 rounded-card border border-border bg-card p-4">
        <div>
          <label htmlFor="name" className="mb-2 block text-sm font-semibold">
            نام و نام خانوادگی
          </label>
          <Input id="name" autoComplete="name" aria-invalid={!!errors.customerName} {...form.register('customerName')} />
          <FieldError>{errors.customerName?.message}</FieldError>
        </div>
        <div>
          <label htmlFor="mobile" className="mb-2 block text-sm font-semibold">
            شماره موبایل
          </label>
          <Input id="mobile" inputMode="numeric" dir="ltr" autoComplete="tel" aria-invalid={!!errors.customerPhone} className="text-right" {...form.register('customerPhone')} />
          <FieldError>{errors.customerPhone?.message}</FieldError>
        </div>
        <div>
          <label id="zoneLbl" className="mb-2 block text-sm font-semibold">
            منطقه
          </label>
          <Controller
            control={form.control}
            name="district"
            render={({ field }) => (
              <Select dir="rtl" value={field.value ? String(field.value) : ''} onValueChange={(v) => field.onChange(Number(v))}>
                <SelectTrigger aria-labelledby="zoneLbl" aria-invalid={!!errors.district} className="h-11 w-full text-sm">
                  <SelectValue placeholder="انتخاب منطقه" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {TEHRAN_DISTRICTS.map((d) => (
                    <SelectItem key={d.district} value={String(d.district)}>
                      {districtLabel(d.district)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FieldError>{errors.district?.message}</FieldError>
          <p className="mt-1.5 mb-0 text-xs leading-6 text-subtle-foreground">زمان‌های نصب بر اساس ظرفیت تکنسین‌های همین منطقه نمایش داده می‌شود.</p>
        </div>
        <div>
          <label htmlFor="addr" className="mb-2 block text-sm font-semibold">
            آدرس کامل
          </label>
          <Textarea id="addr" rows={3} autoComplete="street-address" aria-invalid={!!errors.address} {...form.register('address')} />
          <FieldError>{errors.address?.message}</FieldError>
        </div>
        <div>
          <span id="locLbl" className="mb-2 block text-sm font-semibold">
            محل نصب
          </span>
          <Controller
            control={form.control}
            name="installLocation"
            render={({ field }) => (
              <div role="radiogroup" aria-labelledby="locLbl" className="grid grid-cols-3 gap-2">
                {INSTALL_LOCATIONS.map((l) => (
                  <button
                    key={l}
                    type="button"
                    role="radio"
                    aria-checked={field.value === l}
                    onClick={() => field.onChange(l)}
                    className={cn(
                      'h-10 rounded-control border bg-card text-[13px] text-slate-700',
                      field.value === l ? 'border-2 border-foreground font-bold text-foreground' : 'border-border',
                    )}
                  >
                    {INSTALL_LOCATION_LABELS[l]}
                  </button>
                ))}
              </div>
            )}
          />
        </div>
        <div>
          <label htmlFor="note" className="mb-2 block text-sm font-semibold">
            توضیح برای تکنسین (اختیاری)
          </label>
          <Input id="note" placeholder="مثلاً: پارکینگ طبقه منفی یک، زنگ واحد ۴" {...form.register('customerNote')} />
        </div>
      </form>

      {problem && (
        <div role="alert" className="flex flex-col gap-2.5 rounded-card border border-destructive-border bg-destructive-muted p-3.5 text-sm text-destructive">
          <span className="flex items-start gap-2">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {problem}
          </span>
          <Button className="self-start" onClick={onChangeBattery}>
            تغییر باتری
          </Button>
        </div>
      )}
    </StepShell>
  );
}
