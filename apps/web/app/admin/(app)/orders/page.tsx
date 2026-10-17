'use client';

import { ORDER_STATUSES, ORDER_STATUS_LABELS, type OrderStatus } from '@amprex/shared';
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, ClipboardX, MoreHorizontal, Phone, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { EmptyState, ErrorState } from '@/components/states';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import {
  addDaysIso,
  dayMonth,
  dayMonthYear,
  faNumber,
  faPhone,
  slotRange,
  tehranToday,
  toman,
  weekdayDayMonth,
} from '@/lib/format';
import { useBranches, useChannels, useOrders } from '@/lib/queries';
import type { OrderListItem } from '@/lib/types';
import { useSession } from '@/lib/use-session';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 10;
const NOT_CANCELLED = ORDER_STATUSES.filter((s) => s !== 'CANCELLED');
type Range = 'today' | 'week' | 'month' | 'all';
const RANGE_LABELS: Record<Range, string> = {
  today: 'امروز',
  week: '۷ روز گذشته و آینده',
  month: '۳۰ روز گذشته',
  all: 'همه تاریخ‌ها',
};

function rangeDates(range: Range): { from?: string; to?: string } {
  const today = tehranToday();
  switch (range) {
    case 'today':
      return { from: today, to: today };
    case 'week':
      return { from: addDaysIso(today, -7), to: addDaysIso(today, 7) };
    case 'month':
      return { from: addDaysIso(today, -30), to: today };
    case 'all':
      return {};
  }
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <OrdersScreen />
    </Suspense>
  );
}

/** Filters live in the URL, so a reload or the back button keeps them. */
function useFilters() {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const statusParam = params.get('status');
  const filters = {
    q: params.get('q') ?? '',
    status: (statusParam === 'all' ? [...ORDER_STATUSES] : statusParam ? (statusParam.split(',') as OrderStatus[]) : NOT_CANCELLED) as OrderStatus[],
    channel: params.get('channel') ?? '',
    branch: params.get('branch') ?? '',
    range: (params.get('range') as Range) ?? 'week',
    page: Math.max(1, Number(params.get('page') ?? 1)),
  };
  const set = (patch: Partial<Record<'q' | 'status' | 'channel' | 'branch' | 'range' | 'page', string | null>>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k);
      else next.set(k, v);
    }
    if (!('page' in patch)) next.delete('page');
    router.replace(`${path}${next.size ? `?${next}` : ''}`, { scroll: false });
  };
  const clear = () => router.replace(path, { scroll: false });
  const isDefault = !params.size || (params.size === 1 && params.has('page'));
  return { filters, set, clear, isDefault };
}

function OrdersScreen() {
  const session = useSession();
  const { filters, set, clear, isDefault } = useFilters();
  const [search, setSearch] = useState(filters.q);
  const channels = useChannels();
  const isAdmin = session?.user.role === 'SUPER_ADMIN';
  const branches = useBranches();

  // Debounce typing into the URL.
  useEffect(() => {
    const t = setTimeout(() => search !== filters.q && set({ q: search }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);
  useEffect(() => setSearch(filters.q), [filters.q]);

  const statusCsv = filters.status.length === ORDER_STATUSES.length ? undefined : filters.status.join(',');
  const query = useOrders({
    page: filters.page,
    pageSize: PAGE_SIZE,
    q: filters.q || undefined,
    status: statusCsv,
    channelCode: filters.channel || undefined,
    branchId: filters.branch || undefined,
    ...rangeDates(filters.range),
  });
  const data = query.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  const statusLabel =
    filters.status.length === ORDER_STATUSES.length
      ? 'همه'
      : filters.status.length === NOT_CANCELLED.length && !filters.status.includes('CANCELLED')
        ? 'همه به‌جز لغو'
        : filters.status.length === 1
          ? ORDER_STATUS_LABELS[filters.status[0]!]
          : `${faNumber(filters.status.length)} وضعیت`;
  const toggleStatus = (s: OrderStatus) => {
    const next = filters.status.includes(s) ? filters.status.filter((x) => x !== s) : [...filters.status, s];
    set({ status: next.length === ORDER_STATUSES.length ? 'all' : next.length ? next.join(',') : 'all' });
  };
  const { from, to } = rangeDates(filters.range);
  const rangeText = from && to ? (from === to ? dayMonthYear(from) : `${dayMonth(from)} تا ${dayMonthYear(to)}`) : RANGE_LABELS.all;
  const channelName = channels.data?.find((c) => c.code === filters.channel)?.nameFa;
  const branchName = isAdmin
    ? (branches.data?.find((b) => b.id === filters.branch)?.name ?? 'همه شعبه‌ها')
    : (session?.user.branch?.name ?? '');

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-extrabold">سفارش‌ها</h1>
          <div className="text-[13px] text-subtle-foreground">
            {data ? `${faNumber(data.total)} سفارش در بازه انتخابی` : ' '}
          </div>
        </div>
        <Button asChild>
          <Link href="/order?channel=PHONE">
            <Phone aria-hidden />
            ثبت سفارش تلفنی
          </Link>
        </Button>
      </div>

      <section className="overflow-hidden rounded-card border border-border bg-card">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3.5">
          <div className="relative max-w-[340px] flex-[1_1_260px]">
            <label htmlFor="s" className="sr-only">
              جستجو
            </label>
            <input
              id="s"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجوی کد سفارش یا موبایل"
              className="h-[38px] w-full rounded-control border border-input bg-card ps-9 pe-3 text-[13px] outline-none focus-visible:border-foreground focus-visible:ring-3 focus-visible:ring-ring"
            />
            <Search className="pointer-events-none absolute top-2.5 right-3 size-4 text-subtle-foreground" aria-hidden />
          </div>

          <DropdownMenu dir="rtl">
            <DropdownMenuTrigger asChild>
              <FilterChip on>
                وضعیت: <b className="font-bold text-foreground">{statusLabel}</b>
                <ChevronDown className="size-3.5" aria-hidden />
              </FilterChip>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {ORDER_STATUSES.map((s) => (
                <DropdownMenuCheckboxItem key={s} checked={filters.status.includes(s)} onSelect={(e) => e.preventDefault()} onCheckedChange={() => toggleStatus(s)}>
                  {ORDER_STATUS_LABELS[s]}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => set({ status: null })}>همه به‌جز لغو</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {isAdmin ? (
            <DropdownMenu dir="rtl">
              <DropdownMenuTrigger asChild>
                <FilterChip on>
                  شعبه: <b className="font-bold text-foreground">{branchName}</b>
                  <ChevronDown className="size-3.5" aria-hidden />
                </FilterChip>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuRadioGroup value={filters.branch} onValueChange={(v) => set({ branch: v })}>
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
            <FilterChip on asStatic>
              شعبه: <b className="font-bold text-foreground">{branchName}</b>
            </FilterChip>
          )}

          <DropdownMenu dir="rtl">
            <DropdownMenuTrigger asChild>
              <FilterChip on={!!filters.channel}>
                {channelName ? (
                  <>
                    کانال: <b className="font-bold text-foreground">{channelName}</b>
                  </>
                ) : (
                  <>
                    <ChevronDown className="size-3.5" aria-hidden />
                    کانال
                  </>
                )}
              </FilterChip>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuRadioGroup value={filters.channel} onValueChange={(v) => set({ channel: v })}>
                <DropdownMenuRadioItem value="">همه کانال‌ها</DropdownMenuRadioItem>
                {channels.data?.map((c) => (
                  <DropdownMenuRadioItem key={c.code} value={c.code}>
                    {c.nameFa}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu dir="rtl">
            <DropdownMenuTrigger asChild>
              <FilterChip on>
                <Calendar className="size-4" aria-hidden />
                <b className="font-bold text-foreground">{rangeText}</b>
              </FilterChip>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuRadioGroup value={filters.range} onValueChange={(v) => set({ range: v === 'week' ? null : v })}>
                {(Object.keys(RANGE_LABELS) as Range[]).map((r) => (
                  <DropdownMenuRadioItem key={r} value={r}>
                    {RANGE_LABELS[r]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {!isDefault && (
            <Button variant="ghost" size="sm" className="h-[38px] text-[13px]" onClick={clear}>
              پاک کردن فیلترها
            </Button>
          )}
        </div>

        {query.isPending ? (
          <TableSkeleton bare />
        ) : query.isError && !data ? (
          <ErrorState
            error={query.error}
            title="بارگذاری سفارش‌ها ناموفق بود"
            description="ارتباط با سرور برقرار نشد. فیلترهای شما حفظ شده است."
            onRetry={() => query.refetch()}
            retrying={query.isFetching}
          />
        ) : data && data.items.length === 0 ? (
          <>
            <OrdersTable rows={[]} />
            <EmptyState icon={ClipboardX} title="سفارشی با این فیلترها پیدا نشد" description="جستجو را کوتاه‌تر کنید یا بازه تاریخ را گسترش دهید.">
              {!isDefault && <Button onClick={clear}>پاک کردن فیلترها</Button>}
            </EmptyState>
          </>
        ) : (
          data && (
            <>
              <div className={cn('transition-opacity', query.isFetching && 'opacity-60')} aria-busy={query.isFetching}>
                <OrdersTable rows={data.items} />
              </div>
              <Pagination page={filters.page} pages={pages} total={data.total} onPage={(p) => set({ page: String(p) })} />
            </>
          )
        )}
      </section>
    </>
  );
}

function FilterChip({ on, asStatic, children, ...props }: React.ComponentProps<'button'> & { on?: boolean; asStatic?: boolean }) {
  const cls = cn(
    'inline-flex h-[38px] items-center gap-1.5 rounded-control border bg-card px-3 text-[13px] whitespace-nowrap text-slate-700',
    on ? 'border-solid border-strong-border text-foreground' : 'border-dashed border-slate-300',
  );
  if (asStatic) return <span className={cls}>{children}</span>;
  return (
    <button type="button" className={cls} {...props}>
      {children}
    </button>
  );
}

const COLUMNS: ColumnDef<OrderListItem>[] = [
  {
    id: 'code',
    header: 'کد سفارش',
    cell: ({ row: { original: o } }) => (
      <Link href={`/admin/orders/${o.id}`} className="ltr-code text-[12.5px] font-bold text-foreground no-underline hover:text-foreground hover:underline">
        {o.code}
      </Link>
    ),
  },
  {
    id: 'customer',
    header: 'مشتری',
    cell: ({ row: { original: o } }) => (
      <>
        <div className="font-semibold">{o.customer.fullName}</div>
        <div className="ltr-code text-right text-xs text-subtle-foreground">{faPhone(o.customer.phone)}</div>
      </>
    ),
  },
  {
    id: 'vehicle',
    header: 'وسیله / باتری',
    cell: ({ row: { original: o } }) => (
      <>
        <div>{o.vehicleModel.nameFa}</div>
        <div className="text-xs text-subtle-foreground">{o.battery.nameFa}</div>
      </>
    ),
  },
  {
    id: 'when',
    header: 'زمان نصب',
    cell: ({ row: { original: o } }) => (
      <>
        <div>{o.scheduledDate === tehranToday() ? 'امروز' : weekdayDayMonth(o.scheduledDate)}</div>
        <div className="text-xs text-subtle-foreground">{slotRange(o.slot.startTime, o.slot.endTime)}</div>
      </>
    ),
  },
  { id: 'zone', header: 'منطقه', cell: ({ row: { original: o } }) => <span className="text-muted-foreground">منطقه {faNumber(o.district)}</span> },
  { id: 'channel', header: 'کانال', cell: ({ row: { original: o } }) => <span className="text-muted-foreground">{o.channel.nameFa}</span> },
  {
    id: 'amount',
    header: () => <span className="block text-left">مبلغ (تومان)</span>,
    cell: ({ row: { original: o } }) => <span className="block text-left font-semibold">{toman(o.totalRial)}</span>,
  },
  { id: 'status', header: 'وضعیت', cell: ({ row: { original: o } }) => <StatusBadge status={o.status} /> },
  {
    id: 'actions',
    header: () => <span className="sr-only">عملیات</span>,
    cell: ({ row: { original: o } }) => (
      <DropdownMenu dir="rtl">
        <DropdownMenuTrigger asChild>
          <button aria-label="عملیات سفارش" className="flex size-8 items-center justify-center rounded-sm text-subtle-foreground hover:bg-muted">
            <MoreHorizontal className="size-[18px]" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/admin/orders/${o.id}`}>جزئیات</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];

function OrdersTable({ rows }: { rows: OrderListItem[] }) {
  const table = useReactTable({ data: rows, columns: COLUMNS, getCoreRowModel: getCoreRowModel(), manualPagination: true });
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[1000px] border-collapse text-[13px]">
        <thead>
          {table.getHeaderGroups().map((g) => (
            <tr key={g.id}>
              {g.headers.map((h) => (
                <th key={h.id} className="h-[42px] border-b border-border bg-background px-3.5 text-right font-semibold whitespace-nowrap text-subtle-foreground">
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((r) => (
            <tr key={r.id} className="hover:bg-background">
              {r.getVisibleCells().map((c) => (
                <td key={c.id} className="h-14 border-b border-muted px-3.5 whitespace-nowrap">
                  {flexRender(c.column.columnDef.cell, c.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Pagination({ page, pages, total, onPage }: { page: number; pages: number; total: number; onPage: (p: number) => void }) {
  const first = (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(total, page * PAGE_SIZE);
  // 1 2 3 … n, with the current page always visible.
  const nums = useMemo(() => {
    const set = new Set([1, 2, 3, page - 1, page, page + 1, pages].filter((n) => n >= 1 && n <= pages));
    return [...set].sort((a, b) => a - b);
  }, [page, pages]);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-3 text-[13px] text-muted-foreground">
      <span>
        نمایش {faNumber(first)} تا {faNumber(last)} از {faNumber(total)}
      </span>
      <nav aria-label="صفحه‌بندی" className="flex items-center gap-1">
        <PageButton aria-label="صفحه قبل" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronRight className="size-4" />
        </PageButton>
        {nums.map((n, i) => (
          <span key={n} className="flex items-center gap-1">
            {i > 0 && n - nums[i - 1]! > 1 && <span className="px-1">…</span>}
            <PageButton aria-current={n === page ? 'page' : undefined} onClick={() => onPage(n)} className={cn(n === page && 'border-foreground bg-foreground text-white')}>
              {faNumber(n)}
            </PageButton>
          </span>
        ))}
        <PageButton aria-label="صفحه بعد" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          <ChevronLeft className="size-4" />
        </PageButton>
      </nav>
      <span>{faNumber(PAGE_SIZE)} ردیف در صفحه</span>
    </div>
  );
}

function PageButton({ className, ...props }: React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      className={cn('flex size-9 items-center justify-center rounded-control border border-border bg-card text-[13px] text-foreground disabled:opacity-40', className)}
      {...props}
    />
  );
}

function TableSkeleton({ bare }: { bare?: boolean }) {
  const widths = [120, 110, 124, 104, 116];
  const body = (
    <div role="status" aria-label="در حال بارگذاری" aria-busy className="relative overflow-x-auto">
      <table className="w-full min-w-[1000px] border-collapse text-[13px]">
        <thead>
          <tr>
            {['کد سفارش', 'مشتری', 'وسیله / باتری', 'زمان نصب', 'منطقه', 'کانال', 'مبلغ (تومان)', 'وضعیت'].map((h) => (
              <th key={h} className="h-[42px] border-b border-border bg-background px-3.5 text-right font-semibold whitespace-nowrap text-subtle-foreground">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {widths.map((w, i) => (
            <tr key={i}>
              <td className="h-14 border-b border-muted px-3.5"><Skeleton style={{ width: w }} className="h-3" /></td>
              <td className="h-14 border-b border-muted px-3.5"><Skeleton className="mb-1.5 h-3 w-[90px]" /><Skeleton className="h-[9px] w-[70px]" /></td>
              <td className="h-14 border-b border-muted px-3.5"><Skeleton style={{ width: 130 - i * 8 }} className="h-3" /></td>
              <td className="h-14 border-b border-muted px-3.5"><Skeleton className="h-3 w-20" /></td>
              <td className="h-14 border-b border-muted px-3.5"><Skeleton className="h-3 w-14" /></td>
              <td className="h-14 border-b border-muted px-3.5"><Skeleton className="h-3 w-[50px]" /></td>
              <td className="h-14 border-b border-muted px-3.5"><Skeleton className="h-3 w-[76px]" /></td>
              <td className="h-14 border-b border-muted px-3.5"><Skeleton className="h-[22px] w-[92px] rounded-full" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return bare ? body : <div className="rounded-card border border-border bg-card">{body}</div>;
}
