'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useSyncExternalStore } from 'react';
import type { Role } from '@amprex/shared';
import { getSession, subscribe } from './session';

/** Current session; null when signed out (and during SSR). */
export function useSession() {
  return useSyncExternalStore(subscribe, getSession, () => null);
}

const hydrated = () => true;
/** False on the server render and the first client render, so guards don't flash redirects. */
export function useHydrated() {
  return useSyncExternalStore(subscribe, hydrated, () => false);
}

/** Sends signed-out users (or the wrong role) to the given login page. */
export function useRequireRole(roles: readonly Role[], loginPath: string) {
  const session = useSession();
  const ready = useHydrated();
  const router = useRouter();
  const allowed = !!session && roles.includes(session.user.role);
  useEffect(() => {
    if (ready && !allowed) router.replace(loginPath);
  }, [ready, allowed, router, loginPath]);
  return ready && allowed ? session : null;
}
