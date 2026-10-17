'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { faNumber, parseFaInt } from '@/lib/format';
import type { StockView } from '@/lib/types';

type Mode = 'receipt' | 'transfer';

/** «ثبت ورود کالا» and «انتقال بین انبارها»; the API checks free stock and issues the document number. */
export function StockDialog({
  mode,
  open,
  onOpenChange,
  stock,
  branches,
}: {
  mode: Mode;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  stock: StockView;
  branches: { id: string; name: string }[];
}) {
  const qc = useQueryClient();
  const [batteryId, setBatteryId] = useState('');
  const [toBranchId, setToBranchId] = useState('');
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const quantity = parseFaInt(qty) ?? 0;
  const targets = branches.filter((b) => b.id !== stock.branch.id);
  const free = stock.items.find((i) => i.battery.id === batteryId)?.available;
  const valid = batteryId && quantity >= 1 && (mode === 'receipt' || toBranchId);

  const reset = () => {
    setBatteryId('');
    setToBranchId('');
    setQty('');
    setNote('');
  };

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      const res =
        mode === 'receipt'
          ? await api<{ reference: string }>('/inventory/receipts', {
              method: 'POST',
              body: { branchId: stock.branch.id, batteryId, quantity, note: note.trim() || undefined },
            })
          : await api<{ reference: string }>('/inventory/transfers', {
              method: 'POST',
              body: { fromBranchId: stock.branch.id, toBranchId, batteryId, quantity, note: note.trim() || undefined },
            });
      toast.success(`${mode === 'receipt' ? 'ورود کالا' : 'انتقال'} ثبت شد — ${res.reference}`);
      await qc.invalidateQueries({ queryKey: ['inventory'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (onOpenChange(v), !v && reset())}>
      <DialogContent dir="rtl" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'receipt' ? 'ثبت ورود کالا' : 'انتقال بین انبارها'}</DialogTitle>
          <DialogDescription>{mode === 'receipt' ? `ورود به ${stock.branch.name}` : `از ${stock.branch.name}`}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <label id="prod" className="mb-1.5 block text-[13px] font-semibold">
              محصول
            </label>
            <Select dir="rtl" value={batteryId} onValueChange={setBatteryId}>
              <SelectTrigger aria-labelledby="prod" className="h-11 w-full">
                <SelectValue placeholder="انتخاب کنید" />
              </SelectTrigger>
              <SelectContent>
                {stock.items.map((i) => (
                  <SelectItem key={i.battery.id} value={i.battery.id}>
                    {i.battery.nameFa}
                    {mode === 'transfer' && ` — ${faNumber(i.available)} قابل فروش`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {mode === 'transfer' && (
            <div>
              <label id="dest" className="mb-1.5 block text-[13px] font-semibold">
                انبار مقصد
              </label>
              <Select dir="rtl" value={toBranchId} onValueChange={setToBranchId}>
                <SelectTrigger aria-labelledby="dest" className="h-11 w-full">
                  <SelectValue placeholder="انتخاب کنید" />
                </SelectTrigger>
                <SelectContent>
                  {targets.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <label htmlFor="qty" className="mb-1.5 block text-[13px] font-semibold">
              تعداد
            </label>
            <Input id="qty" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} />
            {mode === 'transfer' && free !== undefined && (
              <p className="mt-1.5 mb-0 text-xs text-subtle-foreground">قابل فروش در مبدأ: {faNumber(free)}</p>
            )}
          </div>
          <div>
            <label htmlFor="snote" className="mb-1.5 block text-[13px] font-semibold">
              توضیح <span className="font-normal text-subtle-foreground">(اختیاری)</span>
            </label>
            <Input id="snote" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="primary" disabled={!valid || busy} onClick={submit}>
            {mode === 'receipt' ? 'ثبت ورود کالا' : 'ثبت انتقال'}
          </Button>
          <Button onClick={() => onOpenChange(false)}>انصراف</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
