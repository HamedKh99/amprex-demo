import type { Role } from '@amprex/shared';

export interface SessionUser {
  id: string;
  fullName: string;
  phone: string;
  role: Role;
  branchId: string | null;
  technicianId: string | null;
  branch: { id: string; name: string } | null;
}

interface Session {
  accessToken: string;
  user: SessionUser;
}

const KEY = 'amprex.session';
const listeners = new Set<() => void>();

// «مرا در این دستگاه به خاطر بسپار» → localStorage; otherwise the session ends with the tab.
function stores(): Storage[] {
  if (typeof window === 'undefined') return [];
  return [window.localStorage, window.sessionStorage];
}

let cache: { raw: string | null; value: Session | null } = { raw: null, value: null };

export function getSession(): Session | null {
  for (const s of stores()) {
    try {
      const raw = s.getItem(KEY);
      if (!raw) continue;
      if (raw !== cache.raw) cache = { raw, value: JSON.parse(raw) as Session };
      return cache.value;
    } catch {
      /* storage blocked or corrupt: treat as signed out */
    }
  }
  return null;
}

export const getToken = () => getSession()?.accessToken ?? null;

export function saveSession(session: Session, remember: boolean) {
  clearSession(false);
  try {
    (remember ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(session));
  } catch {
    /* ignore: the user stays signed in for this page only */
  }
  emit();
}

export function clearSession(notify = true) {
  for (const s of stores()) {
    try {
      s.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }
  cache = { raw: null, value: null };
  if (notify) emit();
}

export function subscribe(fn: () => void) {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => e.key === KEY && fn();
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener('storage', onStorage);
  };
}

function emit() {
  for (const fn of listeners) fn();
}
