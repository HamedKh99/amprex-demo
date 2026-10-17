'use client';

import { Loader2 } from 'lucide-react';
import { useRequireRole } from '@/lib/use-session';

const FIELD_ROLES = ['TECHNICIAN', 'BRANCH_MANAGER', 'SUPER_ADMIN'] as const;

export default function TechAppLayout({ children }: { children: React.ReactNode }) {
  const session = useRequireRole(FIELD_ROLES, '/tech/login');
  if (!session) {
    return (
      <div className="flex min-h-dvh items-center justify-center" role="status" aria-label="در حال بارگذاری">
        <Loader2 className="size-6 animate-spin text-subtle-foreground" aria-hidden />
      </div>
    );
  }
  return children;
}
