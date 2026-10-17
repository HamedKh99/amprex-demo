'use client';

import { ChevronRight, Headset } from 'lucide-react';
import Link from 'next/link';
import { LogoMark } from '@/components/brand/logo-mark';
import { Button } from '@/components/ui/button';
import { faDigits } from '@/lib/format';
import { useSettings } from '@/lib/queries';

export function SiteHeader() {
  const settings = useSettings();
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex min-h-14 max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 md:min-h-[68px] md:px-6">
        <Link href="/" className="flex items-center gap-2.5 text-foreground no-underline hover:text-foreground">
          <LogoMark className="size-9 rounded-[9px]" />
          <span className="text-xl font-extrabold">آمپرکس</span>
        </Link>
        <nav aria-label="منوی اصلی" className="flex flex-wrap items-center gap-1">
          <Button asChild variant="ghost" className="hidden md:inline-flex">
            <a href="#how">نحوه کار</a>
          </Button>
          <Button asChild variant="ghost" className="hidden md:inline-flex">
            <Link href="/order?type=CAR">باتری خودرو</Link>
          </Button>
          <Button asChild variant="ghost" className="hidden md:inline-flex">
            <Link href="/order?type=MOTORCYCLE">باتری موتورسیکلت</Link>
          </Button>
          <Button asChild variant="ghost" className="md:hidden">
            <Link href="/track">پیگیری سفارش</Link>
          </Button>
          <Button asChild className="hidden md:ms-2 md:inline-flex">
            <Link href="/track">پیگیری سفارش</Link>
          </Button>
          {settings.data && (
            <Button asChild size="icon" aria-label="تماس با پشتیبانی" className="md:hidden">
              <a href={`tel:${settings.data.supportPhone}`}>
                <Headset />
              </a>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const settings = useSettings();
  return (
    <footer className="mt-auto bg-foreground text-slate-300">
      <div className="mx-auto flex max-w-[1200px] flex-wrap justify-between gap-4 px-6 py-8 text-sm">
        <div>
          <div className="text-base font-extrabold text-white">آمپرکس</div>
          <div>فروش و نصب باتری خودرو و موتورسیکلت در تهران</div>
        </div>
        <div>
          پشتیبانی:{' '}
          {settings.data ? (
            <a href={`tel:${settings.data.supportPhone}`} className="text-slate-300 hover:text-white">
              {faDigits(settings.data.supportPhone)}
            </a>
          ) : (
            '…'
          )}{' '}
          · همه‌روزه ۸ تا ۲۰
        </div>
      </div>
    </footer>
  );
}

/** Sub-page header for the order flow and tracking: back, title, optional step counter. */
export function FlowHeader({ title, aside, onBack, backHref = '/' }: { title: string; aside?: React.ReactNode; onBack?: () => void; backHref?: string }) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card ps-2 pe-4">
      <div className="flex items-center gap-1">
        {onBack ? (
          <Button variant="ghost" size="icon" aria-label="بازگشت" onClick={onBack} className="text-foreground">
            <ChevronRight className="size-5" />
          </Button>
        ) : (
          <Button asChild variant="ghost" size="icon" aria-label="بازگشت" className="text-foreground">
            <Link href={backHref}>
              <ChevronRight className="size-5" />
            </Link>
          </Button>
        )}
        <span className="text-base font-bold">{title}</span>
      </div>
      {aside && <span className="text-[13px] text-subtle-foreground">{aside}</span>}
    </header>
  );
}
