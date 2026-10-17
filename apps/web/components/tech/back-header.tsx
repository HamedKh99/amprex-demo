import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

/** Technician sub-screen header: back, title, code and an optional status pill. */
export function BackHeader({ title, code, status, href = '/tech' }: { title: string; code?: string; status?: string; href?: string }) {
  return (
    <header className="flex h-[60px] items-center justify-between border-b border-border bg-card ps-2 pe-4">
      <div className="flex items-center gap-1">
        <Link href={href} aria-label="بازگشت" className="flex size-11 items-center justify-center text-foreground">
          <ChevronRight className="size-5" />
        </Link>
        <div>
          <div className="text-base font-extrabold">{title}</div>
          {code && <div className="ltr-code text-right text-xs text-subtle-foreground">{code}</div>}
        </div>
      </div>
      {status && <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-semibold">{status}</span>}
    </header>
  );
}
