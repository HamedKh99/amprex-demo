'use client';

import { Loader2 } from 'lucide-react';
import { AdminShell } from '@/components/admin/shell';
import { useRequireRole } from '@/lib/use-session';

const OFFICE_ROLES = ['SUPER_ADMIN', 'BRANCH_MANAGER', 'OPERATOR'] as const;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = useRequireRole(OFFICE_ROLES, '/admin/login');
  if (!session) {
    return (
      <div className="flex min-h-dvh items-center justify-center" role="status" aria-label="در حال بارگذاری">
        <Loader2 className="size-6 animate-spin text-subtle-foreground" aria-hidden />
      </div>
    );
  }
  return <AdminShell user={session.user}>{children}</AdminShell>;
}
