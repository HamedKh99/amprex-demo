'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { saveSession, type SessionUser } from './session';
import type { VehicleType } from '@amprex/shared';
import type {
  Availability,
  CompatibleBatteries,
  Dashboard,
  LedgerRow,
  LedgerType,
  SalesGroup,
  SalesReport,
  StockView,
  Mission,
  OrderDetail,
  OrderListItem,
  Page,
  Settings,
  Settlement,
  TechnicianOption,
  Tracking,
  VehicleModel,
} from './types';

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

// ── admin ──

export const useOrderCounts = () =>
  useQuery({ queryKey: ['orders', 'counts'], queryFn: () => api<{ waitingAssignment: number }>('/orders/counts'), refetchInterval: 60_000 });

export const useTechnicianOptions = (orderId: string, enabled: boolean) =>
  useQuery({
    queryKey: ['order', orderId, 'technicians'],
    queryFn: () => api<TechnicianOption[]>(`/orders/${orderId}/technicians`),
    enabled,
  });

export interface OrdersFilter {
  page: number;
  pageSize: number;
  q?: string;
  status?: string;
  channelCode?: string;
  branchId?: string;
  from?: string;
  to?: string;
}
export const useOrders = (f: OrdersFilter) =>
  useQuery({
    queryKey: ['orders', 'list', f],
    queryFn: ({ signal }) => api<Page<OrderListItem>>('/orders', { query: { ...f }, signal }),
    placeholderData: keepPreviousData,
  });

export const useChannels = () =>
  useQuery({ queryKey: ['channels'], queryFn: () => api<{ id: string; code: string; nameFa: string }[]>('/lookups/channels', { auth: false }), staleTime: Infinity });

export const useBranches = () =>
  useQuery({ queryKey: ['branches'], queryFn: () => api<{ id: string; code: string; name: string }[]>('/branches'), staleTime: Infinity });

export const useDashboard = () =>
  useQuery({ queryKey: ['dashboard'], queryFn: () => api<Dashboard>('/dashboard'), refetchInterval: 60_000 });

// ── customer site ──

export const useBrands = () =>
  useQuery({
    queryKey: ['catalog', 'brands'],
    queryFn: () => api<{ type: VehicleType; brandFa: string }[]>('/catalog/brands', { auth: false }),
    staleTime: Infinity,
  });

export const useVehicles = (type: VehicleType, brand?: string, q?: string) =>
  useQuery({
    queryKey: ['catalog', 'vehicles', type, brand ?? '', q ?? ''],
    queryFn: ({ signal }) => api<VehicleModel[]>('/catalog/vehicles', { query: { type, brand, q }, auth: false, signal }),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });

export const useCompatible = (vehicleId: string | undefined, district?: number) =>
  useQuery({
    queryKey: ['catalog', 'compatible', vehicleId, district ?? null],
    queryFn: () => api<CompatibleBatteries>(`/catalog/vehicles/${vehicleId}/batteries`, { query: { district }, auth: false }),
    enabled: !!vehicleId,
  });

export const useAvailability = (district: number | undefined) =>
  useQuery({
    queryKey: ['availability', district],
    queryFn: () => api<Availability>('/lookups/availability', { query: { district }, auth: false }),
    enabled: !!district,
    refetchInterval: 60_000,
  });

export const useTrack = (code: string, phone: string, enabled: boolean) =>
  useQuery({
    queryKey: ['track', code, phone],
    // POST: the phone number stays out of URLs and logs.
    queryFn: () => api<Tracking>('/orders/track', { method: 'POST', body: { code, phone }, auth: false }),
    enabled,
    retry: false,
  });

// ── inventory & reports ──

export const useStock = (branchId: string | undefined) =>
  useQuery({
    queryKey: ['inventory', 'stock', branchId],
    queryFn: () => api<StockView>('/inventory/stock', { query: { branchId } }),
    enabled: !!branchId,
  });

export const useLedger = (branchId: string | undefined, f: { from: string; to: string; type?: LedgerType }) =>
  useQuery({
    queryKey: ['inventory', 'ledger', branchId, f],
    queryFn: () => api<LedgerRow[]>('/inventory/movements', { query: { branchId, ...f } }),
    enabled: !!branchId,
    placeholderData: keepPreviousData,
  });

export const useSalesReport = (f: { from: string; to: string; branchId?: string; groupBy: SalesGroup }) =>
  useQuery({
    queryKey: ['reports', 'sales', f],
    queryFn: () => api<SalesReport>('/reports/sales', { query: f }),
    placeholderData: keepPreviousData,
  });
