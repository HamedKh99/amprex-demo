'use client';

import { CORE_RETURN_LABEL, STOCK_MOVEMENT_LABELS, STOCK_MOVEMENT_TYPES } from '@amprex/shared';
import { ArrowLeftRight, ChevronDown, PackageOpen, PackagePlus, ScrollText } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { StockDialog } from '@/components/admin/stock-dialogs';
import { JalaliDatePicker } from '@/components/jalali-date-picker';
import { EmptyState, ErrorState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { dayMonthTime, faNumber, tehranToday } from '@/lib/format';
import { useBranches, useLedger, useStock } from '@/lib/queries';
import type { LedgerRow, LedgerType, StockView } from '@/lib/types';
import { useSession } from '@/lib/use-session';
import { cn } from '@/lib/utils';

const TYPE_LABEL: Record<LedgerType, string> = { ...STOCK_MOVEMENT_LABELS, CORE_RETURN: CORE_RETURN_LABEL };
const TH = 'h-[42px] border-b border-border bg-background px-4 font-semibold whitespace-nowrap text-subtle-foreground';
const TD = 'h-12 border-b border-muted px-4 whitespace-nowrap';

export default function InventoryPage() {
  return (
    <Suspense>
      <Inventory />
    </Suspense>
  );
}

function Inventory() {
  const session = useSession();
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const branches = useBranches();
  const branchId = params.get('branch') ?? branches.data?.[0]?.id;
  const stock = useStock(branchId);
  const [dialog, setDialog] = useState<'receipt' | 'transfer' | null>(null);
  const canWrite = session?.user.role === 'SUPER_ADMIN' || session?.user.role === 'BRANCH_MANAGER';

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-extrabold">موجودی انبار</h1>
          <div className="text-[13px] text-subtle-foreground">قابل فروش = موجود − رزرو · به‌روزرسانی لحظه‌ای</div>
        </div>
        {canWrite && stock.data && (
          <div className="flex gap-2">
            <Button onClick={() => setDialog('transfer')}>
              <ArrowLeftRight aria-hidden />
              انتقال بین انبارها
            </Button>
            <Button variant="primary" onClick={() => setDialog('receipt')}>
              <PackagePlus aria-hidden />
              ثبت ورود کالا
            </Button>
          </div>
        )}
      </div>

      {branches.data && branches.data.length > 1 && (
        <div role="tablist" aria-label="انبار" className="inline-flex flex-wrap gap-1 self-start rounded-touch bg-muted p-1">
          {branches.data.map((b) => {
            const on = b.id === branchId;
            return (
              <button
                key={b.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => router.replace(`${path}?branch=${b.id}`, { scroll: false })}
                className={cn(
                  'h-9 rounded-[7px] px-3.5 text-[13px] font-semibold',
                  on ? 'bg-card text-foreground shadow-[0_1px_2px_rgba(15,23,42,.12)]' : 'text-muted-foreground',
                )}
              >
                انبار {b.name.replace(/^شعبه\s*/, '')}
              </button>
            );
          })}
        </div>
      )}

      {(stock.isPending || branches.isPending) && <StockSkeleton />}
      {(stock.isError || branches.isError) && (
        <div className="rounded-card border border-border bg-card">
          <ErrorState error={stock.error ?? branches.error} title="بارگذاری موجودی ناموفق بود" onRetry={() => stock.refetch()} retrying={stock.isFetching} />
        </div>
      )}
      {stock.data && <StockTable s={stock.data} />}
      {branchId && <Ledger branchId={branchId} />}

      {stock.data && dialog && (
        <StockDialog
          mode={dialog}
          open
          onOpenChange={(v) => !v && setDialog(null)}
          stock={stock.data}
          branches={branches.data ?? []}
        />
      )}
    </>
  );
}

function StockTable({ s }: { s: StockView }) {
  return (
    <section className="overflow-hidden rounded-card border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-border px-4 py-3.5">
        <h2 className="m-0 text-[15px] font-bold">موجودی — {s.branch.name}</h2>
        <div className="flex gap-2">
          {s.belowReorderCount > 0 && <Badge variant="destructive">{faNumber(s.belowReorderCount)} کالا زیر حد سفارش</Badge>}
          <Badge variant="neutral">{faNumber(s.items.length)} کالا</Badge>
        </div>
      </div>
      {s.items.length === 0 ? (
        <EmptyState icon={PackageOpen} title="کالایی در این انبار ثبت نشده است" />
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-[13px]">
            <thead>
              <tr>
                <th className={cn(TH, 'text-right')}>محصول</th>
                <th className={cn(TH, 'text-right')}>کد کالا</th>
                {['موجود', 'رزرو', 'قابل فروش', 'حد سفارش'].map((h) => (
                  <th key={h} className={cn(TH, 'text-left')}>
                    {h}
                  </th>
                ))}
                <th className={cn(TH, 'text-right')}>وضعیت</th>
              </tr>
            </thead>
            <tbody>
              {s.items.map((i) => (
                <tr key={i.id}>
                  <td className={cn(TD, 'font-semibold')}>{i.battery.nameFa}</td>
                  <td className={TD}>
                    <span className="ltr-code text-xs text-muted-foreground">{i.battery.sku}</span>
                  </td>
                  <td className={cn(TD, 'text-left')}>{faNumber(i.onHand)}</td>
                  <td className={cn(TD, 'text-left text-muted-foreground')}>{faNumber(i.reserved)}</td>
                  <td className={cn(TD, 'text-left font-extrabold')}>{faNumber(i.available)}</td>
                  <td className={cn(TD, 'text-left text-muted-foreground')}>{faNumber(i.reorderPoint)}</td>
                  <td className={TD}>
                    {i.belowReorder ? (
                      <Badge dot variant="destructive">
                        زیر حد سفارش
                      </Badge>
                    ) : (
                      <Badge dot variant="success">
                        کافی
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
              <tr className="bg-background">
                <td className={cn(TD, 'font-extrabold')}>جمع</td>
                <td className={TD} />
                <td className={cn(TD, 'text-left font-extrabold')}>{faNumber(s.totals.onHand)}</td>
                <td className={cn(TD, 'text-left font-extrabold')}>{faNumber(s.totals.reserved)}</td>
                <td className={cn(TD, 'text-left font-extrabold')}>{faNumber(s.totals.available)}</td>
                <td className={TD} />
                <td className={TD} />
              </tr>
              <tr>
                <td className={cn(TD, 'font-semibold')}>باتری کهنه (داغی)</td>
                <td className={TD}>
                  <span className="ltr-code text-xs text-muted-foreground">CORE</span>
                </td>
                <td className={cn(TD, 'text-left')}>{faNumber(s.core.count)}</td>
                <td className={cn(TD, 'text-left text-muted-foreground')}>—</td>
                <td className={cn(TD, 'text-left')}>{faNumber(s.core.ampereHours)} آمپر</td>
                <td className={TD} />
                <td className={TD}>
                  <Badge variant="neutral">آماده ارسال بازیافت</Badge>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Ledger({ branchId }: { branchId: string }) {
  const [day, setDay] = useState(tehranToday());
  const [type, setType] = useState<LedgerType | ''>('');
  const ledger = useLedger(branchId, { from: day, to: day, type: type || undefined });

  return (
    <section className="overflow-hidden rounded-card border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-border px-4 py-3.5">
        <h2 className="m-0 text-[15px] font-bold">دفتر گردش کالا</h2>
        <div className="flex gap-2">
          <DropdownMenu dir="rtl">
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="h-[34px] text-[13px]">
                نوع: {type ? TYPE_LABEL[type] : 'همه'}
                <ChevronDown className="size-3.5" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup value={type} onValueChange={(v) => setType(v as LedgerType | '')}>
                <DropdownMenuRadioItem value="">همه</DropdownMenuRadioItem>
                {[...STOCK_MOVEMENT_TYPES, 'CORE_RETURN' as const].map((t) => (
                  <DropdownMenuRadioItem key={t} value={t}>
                    {TYPE_LABEL[t]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <JalaliDatePicker value={day} onChange={setDay} max={tehranToday()} label="روز گردش کالا" />
        </div>
      </div>
      {ledger.isPending ? (
        <div role="status" aria-label="در حال بارگذاری گردش کالا" className="flex flex-col gap-3 p-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      ) : ledger.isError ? (
        <ErrorState error={ledger.error} title="بارگذاری دفتر گردش کالا ناموفق بود" onRetry={() => ledger.refetch()} />
      ) : ledger.data.length === 0 ? (
        <EmptyState icon={ScrollText} title="گردشی در این روز ثبت نشده است" description="روز یا نوع دیگری را انتخاب کنید." />
      ) : (
        <div className={cn('relative overflow-x-auto', ledger.isFetching && 'opacity-60')}>
          <table className="w-full min-w-[900px] border-collapse text-[13px]">
            <thead>
              <tr>
                {['زمان', 'نوع', 'محصول'].map((h) => (
                  <th key={h} className={cn(TH, 'text-right')}>
                    {h}
                  </th>
                ))}
                <th className={cn(TH, 'text-left')}>تعداد</th>
                <th className={cn(TH, 'text-left')}>مانده</th>
                <th className={cn(TH, 'text-right')}>مرجع</th>
                <th className={cn(TH, 'text-right')}>کاربر</th>
              </tr>
            </thead>
            <tbody>
              {ledger.data.map((m) => (
                <LedgerLine key={`${m.type}-${m.id}`} m={m} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function LedgerLine({ m }: { m: LedgerRow }) {
  const plus = m.quantity > 0;
  return (
    <tr>
      <td className={cn(TD, 'text-muted-foreground')}>{dayMonthTime(m.at)}</td>
      <td className={TD}>
        <Badge variant="neutral">{TYPE_LABEL[m.type]}</Badge>
      </td>
      <td className={TD}>{m.type === 'CORE_RETURN' ? `باتری کهنه ${faNumber(m.coreAh ?? 0)} آمپر` : m.productNameFa}</td>
      <td className={cn(TD, 'text-left')}>
        <span dir="ltr" className={cn('font-bold', plus ? 'text-success' : 'text-foreground')}>
          {m.quantity === 0 ? faNumber(0) : `${plus ? '+' : '−'}${faNumber(Math.abs(m.quantity))}`}
        </span>
      </td>
      <td className={cn(TD, 'text-left text-muted-foreground')}>{faNumber(m.balance)}</td>
      <td className={TD}>{m.reference ? <span className="ltr-code text-xs">{m.reference}</span> : '—'}</td>
      <td className={TD}>
        {m.actorName ?? 'سیستم'}
        {m.note && <span className="text-subtle-foreground"> · {m.note}</span>}
      </td>
    </tr>
  );
}

function StockSkeleton() {
  return (
    <div role="status" aria-label="در حال بارگذاری موجودی" className="flex flex-col gap-3 rounded-card border border-border bg-card p-4">
      <Skeleton className="h-5 w-48" />
      {[0, 1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-6 w-full" />
      ))}
    </div>
  );
}
