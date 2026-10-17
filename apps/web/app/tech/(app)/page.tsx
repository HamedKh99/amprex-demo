'use client';

import { ACTIVE_MISSION_STATUSES } from '@amprex/shared';
import { Battery, CalendarCheck, ChevronLeft, LogOut, MapPin, Menu } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EmptyState, ErrorState } from '@/components/states';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { faDigits, faNumber, slotRange, weekdayDayMonth } from '@/lib/format';
import { useMissions } from '@/lib/queries';
import { clearSession } from '@/lib/session';
import type { Mission } from '@/lib/types';
import { useSession } from '@/lib/use-session';
import { cn } from '@/lib/utils';

export default function TechMissionsPage() {
  const session = useSession();
  const router = useRouter();
  const missions = useMissions('today');
  const list = missions.data ?? [];
  const done = list.filter((m) => m.status === 'COMPLETED').length;
  const next = list.find((m) => ACTIVE_MISSION_STATUSES.includes(m.status));
  const rest = list.filter((m) => m !== next);
  const firstName = session?.user.fullName.split(' ')[0] ?? '';

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex flex-col gap-3.5 bg-foreground px-4 pt-[18px] pb-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[13px] text-slate-300">{weekdayDayMonth(new Date())}</div>
            <div className="text-xl font-extrabold">سلام، {firstName}</div>
          </div>
          <DropdownMenu dir="rtl">
            <DropdownMenuTrigger asChild>
              <Button size="icon-touch" aria-label="منو" className="border-slate-700 bg-transparent text-white hover:bg-slate-800 hover:text-white">
                <Menu className="size-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => {
                  clearSession();
                  router.replace('/tech/login');
                }}
              >
                <LogOut aria-hidden />
                خروج
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {missions.isSuccess && list.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-[13px]">
              <span className="text-slate-300">مأموریت‌های امروز</span>
              <span className="font-bold">
                {faNumber(done)} از {faNumber(list.length)} انجام شد
              </span>
            </div>
            <div
              className="grid gap-1"
              style={{ gridTemplateColumns: `repeat(${list.length}, minmax(0, 1fr))` }}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={list.length}
              aria-valuenow={done}
              aria-label="مأموریت‌های امروز"
            >
              {list.map((m, i) => (
                <span key={m.id} className={cn('h-1.5 rounded-[3px]', i < done ? 'bg-white' : 'bg-slate-600')} />
              ))}
            </div>
          </div>
        )}
      </header>

      <main className="flex flex-col gap-3 p-4">
        {missions.isPending && <MissionsSkeleton />}
        {missions.isError && (
          <ErrorState
            error={missions.error}
            title="بارگذاری مأموریت‌ها ناموفق بود"
            onRetry={() => missions.refetch()}
            retrying={missions.isFetching}
          />
        )}
        {missions.isSuccess && list.length === 0 && (
          <EmptyState icon={CalendarCheck} title="امروز مأموریتی ندارید" description="مأموریت‌های جدید پس از تخصیص شعبه این‌جا نمایش داده می‌شوند." />
        )}

        {next && (
          <>
            <h1 className="m-0 text-base font-extrabold">مأموریت بعدی</h1>
            <Link
              href={`/tech/missions/${next.id}`}
              className="flex flex-col gap-3 rounded-sheet border-2 border-foreground bg-card p-4 text-foreground no-underline hover:text-foreground"
            >
              <div className="flex items-center justify-between">
                <span className="text-xl font-extrabold">{slotRange(next.slot.startTime, next.slot.endTime)}</span>
                <StatusBadge status={next.status} audience="tech" />
              </div>
              <div className="flex items-start gap-2 text-sm leading-7">
                <MapPin className="mt-1 size-[18px] shrink-0 text-muted-foreground" aria-hidden />
                <span>
                  <strong>منطقه {faNumber(next.district)}</strong>
                  <br />
                  <span className="text-muted-foreground">{faDigits(next.address)}</span>
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Battery className="size-[18px] shrink-0 text-muted-foreground" aria-hidden />
                {next.battery.nameFa} · {next.vehicleModel.nameFa}
              </div>
              <div className="flex items-center justify-between border-t border-muted pt-3 text-[13px]">
                <span className="ltr-code text-muted-foreground">{next.code}</span>
                <span className="flex items-center gap-1 font-bold">
                  جزئیات
                  <ChevronLeft className="size-4" aria-hidden />
                </span>
              </div>
            </Link>
          </>
        )}

        {rest.length > 0 && (
          <>
            <h2 className="mt-2 mb-0 text-base font-extrabold">بقیه امروز</h2>
            {rest.map((m) => (
              <MissionRow key={m.id} mission={m} />
            ))}
          </>
        )}
      </main>
    </div>
  );
}

function MissionRow({ mission: m }: { mission: Mission }) {
  const finished = m.status === 'COMPLETED';
  return (
    <Link
      href={`/tech/missions/${m.id}`}
      className={cn(
        'flex flex-col gap-1.5 rounded-sheet border border-border px-4 py-3.5 no-underline',
        finished ? 'bg-background text-muted-foreground hover:text-muted-foreground' : 'bg-card text-foreground hover:text-foreground',
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[17px] font-extrabold">{slotRange(m.slot.startTime, m.slot.endTime)}</span>
        <StatusBadge status={m.status} audience="tech" />
      </div>
      <div className="text-sm font-semibold">منطقه {faNumber(m.district)}</div>
      <div className="text-[13px] text-muted-foreground">
        {m.battery.nameFa} · {m.vehicleModel.nameFa}
      </div>
    </Link>
  );
}

function MissionsSkeleton() {
  return (
    <div role="status" aria-label="در حال بارگذاری مأموریت‌ها" className="flex flex-col gap-3">
      <Skeleton className="h-5 w-28" />
      <div className="flex flex-col gap-3 rounded-sheet border-2 border-border bg-card p-4">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-40" />
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-2 rounded-sheet border border-border bg-card px-4 py-3.5">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-4 w-32" />
        </div>
      ))}
    </div>
  );
}
