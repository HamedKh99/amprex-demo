'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { useOrderMutation } from '@/lib/queries';
import type { OrderDetail } from '@/lib/types';

/** «لغو سفارش» with a required reason; the API releases the reserved battery. */
export function CancelDialog({ order, open, onOpenChange }: { order: OrderDetail; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [reason, setReason] = useState('');
  const cancel = useOrderMutation(order.id, () => api<OrderDetail>(`/orders/${order.id}/cancel`, { method: 'POST', body: { reason: reason.trim() } }));
  const valid = reason.trim().length >= 3;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent dir="rtl">
        <AlertDialogHeader>
          <AlertDialogTitle>لغو سفارش</AlertDialogTitle>
          <AlertDialogDescription>
            سفارش <span className="ltr-code">{order.code}</span> لغو و باتری رزروشده به موجودی برمی‌گردد.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div>
          <label htmlFor="reason" className="mb-1.5 block text-[13px] font-semibold">
            دلیل لغو
          </label>
          <Textarea id="reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>انصراف</AlertDialogCancel>
          <Button
            variant="danger"
            disabled={!valid || cancel.isPending}
            onClick={() =>
              cancel.mutate(undefined, {
                onSuccess: () => {
                  toast.success('سفارش لغو شد.');
                  onOpenChange(false);
                  setReason('');
                },
                onError: (e) => toast.error(e.message),
              })
            }
          >
            لغو سفارش
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
