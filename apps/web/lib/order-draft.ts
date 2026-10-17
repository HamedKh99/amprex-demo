'use client';

import type { InstallLocation, VehicleType } from '@amprex/shared';
import { useCallback, useSyncExternalStore } from 'react';

/** Everything the customer has chosen so far; survives a refresh within the tab. */
export interface OrderDraft {
  vehicleType: VehicleType;
  brand?: string;
  vehicleModelId?: string;
  batteryId?: string;
  customerName?: string;
  customerPhone?: string;
  district?: number;
  address?: string;
  installLocation: InstallLocation;
  customerNote?: string;
  scheduledDate?: string;
  slotId?: string;
  /** One key per checkout attempt; retries of «ثبت سفارش» reuse it. */
  idempotencyKey?: string;
  /** Staff phone orders (from the admin panel). */
  channelCode?: string;
}

const KEY = 'amprex.orderDraft';
const EMPTY: OrderDraft = { vehicleType: 'CAR', installLocation: 'PARKING' };
const listeners = new Set<() => void>();
let cache: { raw: string | null; value: OrderDraft } = { raw: null, value: EMPTY };

function read(): OrderDraft {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw !== cache.raw) cache = { raw, value: raw ? { ...EMPTY, ...(JSON.parse(raw) as OrderDraft) } : EMPTY };
  } catch {
    /* storage unavailable: keep the in-memory draft */
  }
  return cache.value;
}

function write(next: OrderDraft) {
  const raw = JSON.stringify(next);
  cache = { raw, value: next };
  try {
    sessionStorage.setItem(KEY, raw);
  } catch {
    /* ignore */
  }
  for (const l of listeners) l();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useOrderDraft() {
  const draft = useSyncExternalStore(subscribe, read, () => EMPTY);
  const update = useCallback((patch: Partial<OrderDraft>) => write({ ...read(), ...patch }), []);
  const reset = useCallback((keep?: Partial<OrderDraft>) => write({ ...EMPTY, ...keep }), []);
  return { draft, update, reset };
}

export function clearOrderDraft() {
  write(EMPTY);
}
