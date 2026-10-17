import type {
  InstallLocation,
  OrderStatus,
  PaymentMethod,
  Role,
  TechnicianFit,
  TrackingMilestone,
  VehicleType,
} from '@amprex/shared';

/** Money from the API: Rial as a decimal string. */
export type Rial = string;

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SlotRef {
  id: string;
  code?: string;
  label: string;
  startTime: string;
  endTime: string;
}

export interface VehicleModel {
  id: string;
  code: string;
  type: VehicleType;
  brandFa: string;
  nameFa: string;
  factoryAh: number;
  groupSize: string;
}

export interface CompatibleBattery {
  id: string;
  sku: string;
  brand: string;
  series: string;
  nameFa: string;
  capacityAh: number;
  coldCrankingA: number;
  warrantyMonths: number;
  priceRial: Rial;
  matchesFactorySpec: boolean;
  inStock: boolean | null;
  price: { batteryPriceRial: Rial; installFeeRial: Rial; coreCreditRial: Rial; totalRial: Rial; estimatedCoreAh: number | null };
  finalPriceExamples: { oldAh: number | null; isEstimate: boolean; totalRial: Rial }[];
}

export interface CompatibleBatteries {
  vehicle: VehicleModel;
  branch: { id: string; name: string } | null;
  coreCreditPerAhRial: Rial;
  batteries: CompatibleBattery[];
}

export type SlotState = 'OPEN' | 'CLOSED' | 'FULL';
export interface Availability {
  branch: { id: string; name: string };
  days: {
    date: string;
    isToday: boolean;
    isFull: boolean;
    slots: (SlotRef & { capacity: number; remaining: number; state: SlotState })[];
  }[];
}

export interface Settings {
  supportPhone: string;
  coreCreditPerAhRial: Rial;
  coreAhMin: number;
  coreAhMax: number;
  bookingDays: number;
}

export interface UserBrief {
  id: string;
  fullName: string;
  role: Role;
}

export interface OrderEvent {
  id: string;
  kind: 'STATUS' | 'NOTE';
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus | null;
  note: string | null;
  data: Record<string, unknown> | null;
  createdAt: string;
  actor: UserBrief | null;
}

export interface OrderListItem {
  id: string;
  code: string;
  status: OrderStatus;
  scheduledDate: string;
  district: number;
  totalRial: Rial;
  customer: { id: string; fullName: string; phone: string };
  branch: { id: string; code: string; name: string };
  channel: { id: string; code: string; nameFa: string };
  vehicleModel: { id: string; nameFa: string; brandFa: string; type: VehicleType };
  battery: { id: string; sku: string; nameFa: string; capacityAh: number };
  slot: SlotRef;
  mission: { technician: { id: string; fullName: string } } | null;
}

export interface OrderDetail {
  id: string;
  code: string;
  status: OrderStatus;
  scheduledDate: string;
  district: number;
  address: string;
  latitude: string | null;
  longitude: string | null;
  installLocation: InstallLocation;
  customerNote: string | null;
  branchNote: string | null;
  estimatedCoreAh: number | null;
  batteryPriceRial: Rial;
  installFeeRial: Rial;
  coreCreditRial: Rial;
  totalRial: Rial;
  cancelReason: string | null;
  createdAt: string;
  completedAt: string | null;
  customer: { id: string; fullName: string; phone: string };
  branch: { id: string; code: string; name: string; phone: string };
  channel: { id: string; code: string; nameFa: string };
  vehicleModel: VehicleModel;
  battery: {
    id: string;
    sku: string;
    brand: string;
    series: string;
    nameFa: string;
    capacityAh: number;
    coldCrankingA: number;
    groupSize: string;
    warrantyMonths: number;
  };
  slot: SlotRef & { capacity: number };
  mission: {
    technician: { id: string; fullName: string; phone: string };
    assignedAt: string;
    acceptedAt: string | null;
    departedAt: string | null;
    arrivedAt: string | null;
    startedAt: string | null;
    installedAt: string | null;
    installedSerial: string | null;
    technicianNote: string | null;
  } | null;
  coreReturn: { returned: boolean; ampereHours: number | null; creditAppliedRial: Rial; recordedAt: string } | null;
  payments: {
    id: string;
    amountRial: Rial;
    expectedRial: Rial;
    method: PaymentMethod;
    reference: string | null;
    paidAt: string | null;
    receivedBy: UserBrief | null;
  }[];
  events: OrderEvent[];
  movements: { id: string; type: string; quantity: number; createdAt: string; branch: { name: string }; actor: UserBrief | null }[];
  slotLoad: { booked: number; capacity: number };
  customerHistory: { previousOrders: number; firstOrderAt: string | null };
  financials: { batteryCostRial: Rial; coreScrapValueRial: Rial; grossProfitRial: Rial; isEstimate: boolean } | null;
  allowedTransitions: OrderStatus[];
}

export interface TechnicianOption {
  id: string;
  fullName: string;
  phone: string;
  userId: string | null;
  serviceDistricts: number[];
  dailyCapacity: number;
  load: number;
  isCurrent: boolean;
  inZone: boolean;
  zoneJobs: number;
  slotJobs: number;
  full: boolean;
  fit: TechnicianFit;
}

export interface Mission {
  id: string;
  code: string;
  status: OrderStatus;
  scheduledDate: string;
  district: number;
  address: string;
  installLocation: InstallLocation;
  customerNote: string | null;
  branchNote: string | null;
  totalRial: Rial;
  customer: { fullName: string; phone: string };
  vehicleModel: { nameFa: string };
  battery: { sku: string; nameFa: string; capacityAh: number };
  slot: SlotRef;
  allowedTransitions: OrderStatus[];
}

export interface Settlement {
  batteryPriceRial: Rial;
  installFeeRial: Rial;
  coreCreditRial: Rial;
  totalRial: Rial;
  coreAh: number | null;
  estimateTotalRial: Rial;
  differenceRial: Rial;
}

export interface Tracking {
  code: string;
  status: OrderStatus;
  scheduledDate: string;
  slot: SlotRef;
  vehicleModel: { nameFa: string };
  battery: { brand: string; nameFa: string; capacityAh: number; warrantyMonths: number };
  branch: { name: string; phone: string };
  totalRial: Rial;
  technician: { fullName: string; phone: string } | null;
  milestones: { key: TrackingMilestone; state: 'DONE' | 'NOW' | 'TODO'; at: string | null }[];
}

export type DashboardAlert =
  | { type: 'UNASSIGNED'; severity: 'HIGH'; slot: SlotRef; count: number; districts: number[]; minutesLeft: number }
  | { type: 'LATE_ARRIVAL'; severity: 'HIGH'; orderId: string; code: string; technician: { fullName: string; phone: string } | null; minutesLate: number }
  | { type: 'LOW_STOCK'; severity: 'MEDIUM'; batteryId: string; nameFa: string; branchName: string; available: number; reservedTomorrow: number }
  | { type: 'SETTLEMENT_MISMATCH'; severity: 'MEDIUM'; orderId: string; code: string; differenceRial: Rial };

export interface Dashboard {
  date: string;
  updatedAt: string;
  kpis: {
    ordersToday: number;
    byChannel: { code: string; nameFa: string; count: number }[];
    waitingAssignment: number;
    nextWaitingSlot: { slot: SlotRef; count: number } | null;
    completed: number;
    completedPercent: number;
    salesRial: Rial;
    grossProfitRial: Rial | null;
  };
  byStatus: { status: OrderStatus; count: number }[];
  alerts: DashboardAlert[];
  technicians: {
    id: string;
    fullName: string;
    serviceDistricts: number[];
    dailyCapacity: number;
    load: number;
    openMissions: number;
    current: OrderStatus | 'FREE' | 'FULL';
  }[];
}
