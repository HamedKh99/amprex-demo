'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { saveSession, type SessionUser } from './session';
import type { Mission, OrderDetail, Settings, Settlement } from './types';

export const keys = {
  settings: ['settings'] as const,
  missions: (view: string) => ['missions', view] as const,
  order: (id: string) => ['order', id] as const,
  settlement: (id: string, core: boolean, ah: number | null) => ['settlement', id, core, ah] as const,
};

export function useLogin() {
  return useMutation({
    mutationFn: async (v: { phone: string; password: string; remember: boolean }) => {
      const res = await api<{ accessToken: string; user: SessionUser }>('/auth/login', {
        method: 'POST',
        body: { phone: v.phone, password: v.password },
        auth: false,
      });
      saveSession(res, v.remember);
      return res.user;
    },
  });
}

export const useSettings = () =>
  useQuery({ queryKey: keys.settings, queryFn: () => api<Settings>('/lookups/settings', { auth: false }), staleTime: Infinity });

export const useMissions = (view: 'today' | 'active' | 'upcoming' | 'history' = 'today') =>
  useQuery({ queryKey: keys.missions(view), queryFn: () => api<Mission[]>('/missions', { query: { view } }) });

export const useOrder = (id: string) =>
  useQuery({ queryKey: keys.order(id), queryFn: () => api<OrderDetail>(`/orders/${id}`) });

/** Live payable for the finish form; keeps the last answer on screen while the next loads. */
export const useSettlement = (id: string, coreReturned: boolean, ah: number | null, enabled = true) =>
  useQuery({
    queryKey: keys.settlement(id, coreReturned, ah),
    queryFn: () =>
      api<Settlement>(`/missions/${id}/settlement`, { query: { coreReturned, oldBatteryAh: coreReturned ? ah : undefined } }),
    enabled,
    placeholderData: keepPreviousData,
  });

/** Writes the fresh order into the cache and refreshes lists that show it. */
export function useOrderMutation<V>(id: string, fn: (v: V) => Promise<OrderDetail>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (order) => {
      qc.setQueryData(keys.order(id), order);
      void qc.invalidateQueries({ queryKey: ['missions'] });
      void qc.invalidateQueries({ queryKey: ['orders'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
