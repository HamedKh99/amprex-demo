'use client';

import { Check, CircleCheck, Copy } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { LogoMark } from '@/components/brand/logo-mark';
import { LAST_ORDER_KEY } from '@/components/order/step-review';
import { Button } from '@/components/ui/button';
import { faNumber, slotRange, toman, weekdayDayMonth } from '@/lib/format';
import { clearOrderDraft } from '@/lib/order-draft';
import type { OrderDetail } from '@/lib/types';

export default function OrderSuccessPage() {
  return (
    <Suspense>
      <Success />
    </Suspense>
  );
}

function Success() {
  const params = useSearchParams();
  const code = params.get('code') ?? '';
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // The checkout is over: start the next one fresh.
    clearOrderDraft();
    try {
      const raw = sessionStorage.getItem(LAST_ORDER_KEY);
      const o = raw ? (JSON.parse(raw) as OrderDetail) : null;
      if (o?.code === code) setOrder(o);
    } catch {
      /* show the code only */
    }
  }, [code]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success('کد پیگیری کپی شد.');
    } catch {
      toast.error('کپی انجام نشد؛ کد را دستی یادداشت کنید.');
    }
  };
  const trackHref = `/track?code=${encodeURIComponent(code)}`;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col bg-background">
      <header className="flex h-14 items-center gap-2 border-b border-border bg-card px-4">
        <LogoMark className="size-8 rounded-control" iconClassName="size-4" />
        <span className="text-base font-extrabold">آمپرکس</span>
      </header>
      <main className="flex flex-1 flex-col gap-5 px-4 pt-8 pb-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-[72px] items-center justify-center rounded-full border border-success-border bg-success-muted text-success">
            <CircleCheck className="size-9" aria-hidden />
          </span>
          <h1 className="m-0 text-[22px] font-extrabold">سفارش شما ثبت شد</h1>
        </div>

        <section className="flex flex-col gap-2 rounded-card border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-subtle-foreground">کد پیگیری</span>
            <Button size="sm" aria-label="کپی کد پیگیری" onClick={copy} className="h-8 px-2.5 text-[13px]">
              {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
              کپی
            </Button>
          </div>
          <div className="ltr-code text-center text-2xl font-extrabold tracking-wide">{code}</div>
          <p className="m-0 text-center text-xs text-subtle-foreground">این کد را برای پیگیری و تماس با پشتیبانی نگه دارید.</p>
        </section>

        {order && (
          <section className="rounded-card border border-border bg-card px-4 py-1">
            <Row label="زمان نصب">
              {weekdayDayMonth(order.scheduledDate)} · {slotRange(order.slot.startTime, order.slot.endTime)}
            </Row>
            <Row label="باتری">
              {order.battery.brand} · {faNumber(order.battery.capacityAh)} آمپر
            </Row>
            <Row label="مبلغ تقریبی" last>
              {toman(order.totalRial)} تومان
            </Row>
          </section>
        )}

        <section className="flex flex-col gap-2.5">
          <h2 className="m-0 text-sm font-bold">بعد از این</h2>
          <ol className="m-0 flex list-none flex-col gap-2 p-0 text-[13px] leading-7 text-slate-700">
            <li>۱. کارشناس ما سفارش را بررسی و تکنسین را تعیین می‌کند.</li>
            <li>۲. تکنسین ۳۰ دقیقه پیش از رسیدن با شما تماس می‌گیرد.</li>
            <li>۳. باتری کهنه را در خودرو نگه دارید تا اعتبار آن کسر شود.</li>
          </ol>
        </section>

        <div className="mt-auto flex flex-col gap-2.5">
          <Button asChild variant="primary" size="lg">
            <Link href={trackHref}>پیگیری سفارش</Link>
          </Button>
          <Button asChild size="lg">
            <Link href="/">بازگشت به صفحه اصلی</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}

function Row({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 py-3 text-sm ${last ? '' : 'border-b border-muted'}`}>
      <span className="text-subtle-foreground">{label}</span>
      <span className="font-semibold">{children}</span>
    </div>
  );
}
