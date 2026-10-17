'use client';

import { ChevronDown, Download, FileBarChart } from 'lucide-react';
import { useState } from 'react';
import { JalaliDatePicker, jalaliMonthStart } from '@/components/jalali-date-picker';
import { EmptyState, ErrorState } from '@/components/states';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { faNumber, tehranToday, tomanMillions } from '@/lib/format';
import { useBranches, useSalesReport } from '@/lib/queries';
import type { SalesGroup, SalesReport } from '@/lib/types';
import { useSession } from '@/lib/use-session';
import { cn } from '@/lib/utils';

const GROUPS: { key: SalesGroup; label: string }[] = [
  { key: 'product', label: 'محصول' },
  { key: 'channel', label: 'کانال' },
  { key: 'product_channel', label: 'محصول × کانال' },
];

const pct = (n: number) => `${new Intl.NumberFormat('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n)}٪`;

export default function ReportsPage() {
  const session = useSession();
  const isAdmin = session?.user.role === 'SUPER_ADMIN';
  const branches = useBranches();
  const today = tehranToday();
  const [from, setFrom] = useState(() => jalaliMonthStart(today));
  const [to, setTo] = useState(today);
  const [branchId, setBranchId] = useState('');
  const [groupBy, setGroupBy] = useState<SalesGroup>('product_channel');
  const report = useSalesReport({ from, to, branchId: branchId || undefined, groupBy });
  const r = report.data;
  const branchName = isAdmin ? (branches.data?.find((b) => b.id === branchId)?.name ?? 'همه شعبه‌ها') : (session?.user.branch?.name ?? '');

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-extrabold">گزارش فروش و سود</h1>
          <div className="text-[13px] text-subtle-foreground">فقط سفارش‌های تکمیل‌شده · مبالغ به میلیون تومان</div>
        </div>
        <Button variant="primary" disabled={!r || r.rows.length === 0} onClick={() => r && downloadCsv(r)}>
          <Download aria-hidden />
          دریافت CSV
        </Button>
      </div>

      <section className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-card border border-border bg-card p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-semibold text-muted-foreground">بازه</span>
          <JalaliDatePicker value={from} onChange={setFrom} max={to} prefix="از" label="از تاریخ" />
          <JalaliDatePicker value={to} onChange={setTo} min={from} max={today} prefix="تا" label="تا تاریخ" />
          {isAdmin ? (
            <DropdownMenu dir="rtl">
              <DropdownMenuTrigger asChild>
                <button type="button" className="inline-flex h-[38px] items-center gap-2 rounded-control border border-input bg-card px-3 text-[13px]">
                  شعبه: {branchName}
                  <ChevronDown className="size-3.5" aria-hidden />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuRadioGroup value={branchId} onValueChange={setBranchId}>
                  <DropdownMenuRadioItem value="">همه شعبه‌ها</DropdownMenuRadioItem>
                  {branches.data?.map((b) => (
                    <DropdownMenuRadioItem key={b.id} value={b.id}>
                      {b.name}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <span className="inline-flex h-[38px] items-center rounded-control border border-input bg-card px-3 text-[13px]">شعبه: {branchName}</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span id="grp" className="text-[13px] font-semibold text-muted-foreground">
            گروه‌بندی
          </span>
          <div role="radiogroup" aria-labelledby="grp" className="inline-flex gap-1 rounded-touch bg-muted p-1">
            {GROUPS.map((g) => (
              <button
                key={g.key}
                type="button"
                role="radio"
                aria-checked={groupBy === g.key}
                onClick={() => setGroupBy(g.key)}
                className={cn(
                  'h-8 rounded-sm px-3 text-[13px] font-semibold',
                  groupBy === g.key ? 'bg-card text-foreground shadow-[0_1px_2px_rgba(15,23,42,.12)]' : 'text-muted-foreground',
                )}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {report.isPending && <ReportSkeleton />}
      {report.isError && !r && (
        <div className="rounded-card border border-border bg-card">
          <ErrorState error={report.error} title="بارگذاری گزارش ناموفق بود" onRetry={() => report.refetch()} retrying={report.isFetching} />
        </div>
      )}
      {r && <ReportView r={r} fetching={report.isFetching} />}
    </>
  );
}

function ReportView({ r, fetching }: { r: SalesReport; fetching: boolean }) {
  const t = r.totals;
  const showProduct = r.groupBy !== 'channel';
  const showChannel = r.groupBy !== 'product';
  const tiles = [
    { label: 'سفارش تکمیل‌شده', value: faNumber(t.count) },
    { label: 'فروش (میلیون تومان)', value: tomanMillions(t.grossRial) },
    { label: 'اعتبار داغی', value: tomanMillions(t.creditRial) },
    { label: 'سود ناخالص', value: tomanMillions(t.profitRial) },
    { label: 'حاشیه سود', value: pct(t.marginPercent) },
  ];

  if (r.rows.length === 0) {
    return (
      <div className="rounded-card border border-border bg-card">
        <EmptyState icon={FileBarChart} title="در این بازه سفارش تکمیل‌شده‌ای نیست" description="بازه تاریخ یا شعبه را تغییر دهید." />
      </div>
    );
  }

  const cells = (x: SalesReport['totals']) => [
    faNumber(x.count),
    tomanMillions(x.grossRial),
    BigInt(x.creditRial) === 0n ? faNumber(0) : (
      <span key="c" dir="ltr">
        −{tomanMillions(x.creditRial)}
      </span>
    ),
    tomanMillions(x.netRial),
    tomanMillions(x.costRial),
    tomanMillions(x.profitRial),
    pct(x.marginPercent),
  ];
  const TH = 'h-[42px] border-b border-border bg-background px-4 font-semibold whitespace-nowrap text-subtle-foreground';
  const TD = 'h-12 border-b border-muted px-4 whitespace-nowrap';

  return (
    <div className={cn('flex flex-col gap-4 transition-opacity', fetching && 'opacity-60')} aria-busy={fetching}>
      <section aria-label="خلاصه" className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
        {tiles.map((s) => (
          <div key={s.label} className="flex flex-col gap-1.5 rounded-card border border-border bg-card p-4">
            <span className="text-xs font-semibold text-muted-foreground">{s.label}</span>
            <span className="text-2xl font-extrabold">{s.value}</span>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-card border border-border bg-card">
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-[13px]">
            <thead>
              <tr>
                {showProduct && <th className={cn(TH, 'text-right')}>محصول</th>}
                {showChannel && <th className={cn(TH, 'text-right')}>کانال</th>}
                {['تعداد', 'فروش', 'اعتبار داغی', 'دریافتی خالص', 'بهای تمام‌شده*', 'سود ناخالص', 'حاشیه'].map((h) => (
                  <th key={h} className={cn(TH, 'text-left')}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="bg-muted font-extrabold">
                {showProduct && <td className={cn(TD, 'border-border')}>جمع کل</td>}
                {showChannel && <td className={cn(TD, 'border-border')}>{showProduct ? 'همه کانال‌ها' : 'جمع کل'}</td>}
                {cells(t).map((c, i) => (
                  <td key={i} className={cn(TD, 'border-border text-left')}>
                    {c}
                  </td>
                ))}
              </tr>
              {r.rows.map((x) => (
                <tr key={`${x.sku}-${x.channelCode}`} className="hover:bg-background">
                  {showProduct && <td className={cn(TD, 'font-semibold')}>{x.productNameFa}</td>}
                  {showChannel && <td className={cn(TD, 'text-muted-foreground')}>{x.channelNameFa}</td>}
                  {cells(x).map((c, i) => (
                    <td key={i} className={cn(TD, 'text-left', i === 5 && 'font-bold')}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="m-0 border-t border-muted px-4 py-3 text-xs text-subtle-foreground">
          * بهای خرید باتری منهای ارزش بازیافت باتری کهنه تحویل‌گرفته. حاشیه = سود ناخالص ÷ دریافتی خالص.
        </p>
      </section>
    </div>
  );
}

/** Same figures as the table, in Toman, for spreadsheets (UTF-8 with BOM so Excel reads Persian). */
function downloadCsv(r: SalesReport) {
  const toman = (rial: string) => (BigInt(rial) / 10n).toString();
  const head = ['محصول', 'کد کالا', 'کانال', 'تعداد', 'فروش (تومان)', 'اعتبار داغی (تومان)', 'دریافتی خالص (تومان)', 'بهای تمام‌شده (تومان)', 'سود ناخالص (تومان)', 'حاشیه (٪)'];
  const lines = r.rows.map((x) => [
    x.productNameFa ?? '',
    x.sku ?? '',
    x.channelNameFa ?? '',
    String(x.count),
    toman(x.grossRial),
    toman(x.creditRial),
    toman(x.netRial),
    toman(x.costRial),
    toman(x.profitRial),
    x.marginPercent.toFixed(1),
  ]);
  const csv = [head, ...lines].map((l) => l.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `amprex-sales-${r.range.from}-${r.range.to}.csv` });
  a.click();
  URL.revokeObjectURL(url);
}

function ReportSkeleton() {
  return (
    <div role="status" aria-label="در حال بارگذاری گزارش" className="flex flex-col gap-4">
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20 rounded-card" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-card" />
    </div>
  );
}
