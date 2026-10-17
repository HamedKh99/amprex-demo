'use client';

import { ROLE_LABELS } from '@amprex/shared';
import { BarChart3, ChevronDown, ClipboardList, LayoutDashboard, LogOut, Package } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogoMark } from '@/components/brand/logo-mark';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { faNumber } from '@/lib/format';
import { useOrderCounts } from '@/lib/queries';
import { clearSession, type SessionUser } from '@/lib/session';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Screens not built in this version are shown but not linked. */
  ready: boolean;
}

const NAV: NavItem[] = [
  { label: 'داشبورد', href: '/admin', icon: LayoutDashboard, ready: true },
  { label: 'سفارش‌ها', href: '/admin/orders', icon: ClipboardList, ready: true },
  { label: 'موجودی انبار', href: '/admin/inventory', icon: Package, ready: false },
  { label: 'گزارش‌ها', href: '/admin/reports', icon: BarChart3, ready: false },
];

/** Design: 240px sidebar beside the content; wraps above it on narrow screens. */
export function AdminShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const counts = useOrderCounts();
  const waiting = counts.data?.waitingAssignment ?? 0;

  return (
    <div className="flex min-h-dvh flex-wrap items-stretch bg-background">
      <aside className="flex grow shrink basis-60 flex-col gap-1 border-border bg-card px-3 py-4 md:max-w-60 md:border-e">
        <div className="flex items-center gap-2 px-2 pt-1 pb-[18px]">
          <LogoMark className="size-8 rounded-control" iconClassName="size-4" />
          <span className="text-[17px] font-extrabold">آمپرکس</span>
          <span className="ms-auto text-[11px] text-subtle-foreground">مدیریت</span>
        </div>
        <nav aria-label="منوی پنل" className="flex flex-col gap-0.5">
          {NAV.map((n) => {
            const active = n.href === '/admin' ? path === '/admin' : path.startsWith(n.href);
            const inner = (
              <>
                <n.icon className="size-[18px] shrink-0" aria-hidden />
                <span className="flex-1">{n.label}</span>
                {n.href === '/admin/orders' && waiting > 0 && (
                  <span className="rounded-full bg-foreground px-[7px] text-[11px] leading-5 font-bold text-white">{faNumber(waiting)}</span>
                )}
              </>
            );
            const cls = cn(
              'flex h-10 items-center gap-2.5 rounded-control px-3 text-sm font-medium text-slate-700 no-underline',
              active ? 'bg-muted font-bold text-foreground' : 'hover:bg-muted hover:text-foreground',
              !n.ready && 'pointer-events-none opacity-50',
            );
            return n.ready ? (
              <Link key={n.href} href={n.href} aria-current={active ? 'page' : undefined} className={cls}>
                {inner}
              </Link>
            ) : (
              <span key={n.href} aria-disabled className={cls}>
                {inner}
              </span>
            );
          })}
        </nav>
        <DropdownMenu dir="rtl">
          <DropdownMenuTrigger asChild>
            <button className="mt-auto flex items-center gap-2.5 rounded-touch border border-border bg-card p-2.5 text-start">
              <span className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-border text-sm font-bold">
                {user.fullName.charAt(0)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-bold">{user.fullName}</span>
                <span className="block truncate text-[11px] text-subtle-foreground">
                  {ROLE_LABELS[user.role]}
                  {user.branch && ` — ${user.branch.name}`}
                </span>
              </span>
              <ChevronDown className="size-4 text-subtle-foreground" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuItem
              onSelect={() => {
                clearSession();
                router.replace('/admin/login');
              }}
            >
              <LogOut aria-hidden />
              خروج
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </aside>
      <main className="flex min-w-0 grow-[999] shrink basis-[560px] flex-col gap-[18px] px-4 pt-5 pb-10 md:px-7">{children}</main>
    </div>
  );
}
