/**
 * Demo seed: wipes all data and recreates it deterministically (fixed PRNG seed).
 * Timestamps are relative to "now", so the dashboard always has a realistic "today":
 * jobs finished this morning, technicians on the road, an unassigned order in an upcoming
 * slot and one settlement mismatch.
 *   pnpm db:seed
 */
import { toPersianDigits } from '@amprex/shared';
import { config } from 'dotenv';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  type Battery,
  type InstallLocation,
  type OrderStatus,
  type PaymentMethod,
  PrismaClient,
  type ServiceSlot,
  type VehicleModel,
} from '../src/generated/prisma/client.js';
import { BUSINESS_RULES } from '../src/config/business-rules.js';
import { documentCode, orderCode } from '../src/orders/order-code.js';
import { breakdown, coreScrapValue, quote } from '../src/pricing/pricing.js';
import {
  BATTERIES,
  BRANCH_NOTES,
  BRANCHES,
  type BranchCode,
  CHANNELS,
  CUSTOMER_FIRST_NAMES,
  CUSTOMER_LAST_NAMES,
  DEMO_USERS,
  FREE_STOCK,
  SLOTS,
  STREETS,
  TECHNICIANS,
  VEHICLE_MODELS,
} from './seed-data.js';

config({ path: ['.env', '../../.env'], quiet: true });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL is not set (copy .env.example to .env)');
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD;
if (!DEMO_PASSWORD) throw new Error('SEED_DEMO_PASSWORD is not set (see .env.example)');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) });

// ───────────── deterministic helpers ─────────────

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(1405);
const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
const chance = (p: number) => rand() < p;
function weighted<T extends { weight: number }>(xs: readonly T[]): T {
  let r = rand() * xs.reduce((s, x) => s + x.weight, 0);
  for (const x of xs) if ((r -= x.weight) < 0) return x;
  return xs[xs.length - 1]!;
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const TEHRAN_OFFSET = 3.5 * HOUR; // Iran has no DST since 2022.
const NOW = Date.now();

/** The Tehran calendar date of an instant, as a UTC-midnight Date (for @db.Date). */
function tehranDate(ms: number): Date {
  const d = new Date(ms + TEHRAN_OFFSET);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
/** Instant of HH:mm Tehran time on the given Tehran date. */
function atTehran(date: Date, hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return date.getTime() + h! * HOUR + m! * MIN - TEHRAN_OFFSET;
}

// ───────────── order plan ─────────────

const PATH: OrderStatus[] = ['CREATED', 'ASSIGNED', 'ACCEPTED', 'EN_ROUTE', 'ON_SITE', 'INSTALLING', 'COMPLETED'];
const HOLDS_STOCK: OrderStatus[] = ['CREATED', 'ASSIGNED', 'ACCEPTED', 'EN_ROUTE', 'ON_SITE', 'INSTALLING'];

/**
 * 40 orders. `when`: past = 2–30 days ago; today = scheduled today; tomorrow = booked ahead.
 * Today's in-flight jobs in WEST go to the demo technician so /tech has a full day.
 */
const PLAN: { status: OrderStatus; when: 'past' | 'today' | 'tomorrow'; branch?: BranchCode }[] = [
  ...Array.from({ length: 22 }, () => ({ status: 'COMPLETED' as const, when: 'past' as const })),
  ...Array.from({ length: 3 }, () => ({ status: 'CANCELLED' as const, when: 'past' as const })),
  { status: 'COMPLETED', when: 'today', branch: 'WEST' },
  { status: 'COMPLETED', when: 'today', branch: 'WEST' },
  { status: 'COMPLETED', when: 'today', branch: 'EAST' },
  { status: 'COMPLETED', when: 'today', branch: 'EAST' },
  { status: 'CANCELLED', when: 'today', branch: 'EAST' },
  { status: 'INSTALLING', when: 'today', branch: 'EAST' },
  { status: 'ON_SITE', when: 'today', branch: 'WEST' },
  { status: 'EN_ROUTE', when: 'today', branch: 'WEST' },
  { status: 'EN_ROUTE', when: 'today', branch: 'EAST' },
  { status: 'ACCEPTED', when: 'today', branch: 'WEST' },
  { status: 'ASSIGNED', when: 'today', branch: 'WEST' },
  { status: 'CREATED', when: 'today', branch: 'WEST' },
  { status: 'CREATED', when: 'today', branch: 'EAST' },
  { status: 'ASSIGNED', when: 'tomorrow', branch: 'EAST' },
  { status: 'CREATED', when: 'tomorrow', branch: 'WEST' },
];

const PAYMENT_METHODS: { value: PaymentMethod; weight: number }[] = [
  { value: 'CARD_POS', weight: 60 },
  { value: 'CARD_TO_CARD', weight: 20 },
  { value: 'CASH', weight: 20 },
];
const LOCATIONS: { value: InstallLocation; weight: number }[] = [
  { value: 'PARKING', weight: 60 },
  { value: 'STREET', weight: 25 },
  { value: 'WORKPLACE', weight: 15 },
];
const CANCEL_REASONS = ['انصراف مشتری', 'عدم پاسخگویی مشتری', 'خودرو در محل نبود', 'خرید از جای دیگر'];

async function wipe() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE "Payment", "CoreReturn", "Mission", "OrderEvent", "StockMovement", "Order",
             "Customer", "Stock", "BatteryCompatibility", "Battery", "VehicleModel",
             "Technician", "User", "Branch", "Channel", "ServiceSlot" CASCADE`);
  await prisma.$executeRawUnsafe(`SELECT setval('"Order_number_seq"', 1000, true)`);
}

async function main() {
  await wipe();

  // ── organisation ──
  const branches = new Map<BranchCode, string>();
  for (const b of BRANCHES) {
    const row = await prisma.branch.create({ data: { ...b, serviceDistricts: [...b.serviceDistricts] } });
    branches.set(b.code, row.id);
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD!, 10);
  const users = new Map<string, string>(); // role → id
  for (const u of DEMO_USERS) {
    const row = await prisma.user.create({
      data: {
        phone: u.phone,
        fullName: u.fullName,
        passwordHash,
        role: u.role,
        branchId: u.branch ? branches.get(u.branch)! : null,
      },
    });
    users.set(u.role, row.id);
  }

  const techsByBranch = new Map<BranchCode, { id: string; userId: string | null; districts: number[] }[]>();
  for (const t of TECHNICIANS) {
    const userId = t.demoUser ? users.get('TECHNICIAN')! : null;
    const row = await prisma.technician.create({
      data: {
        branchId: branches.get(t.branch)!,
        fullName: t.fullName,
        phone: t.phone,
        serviceDistricts: t.serviceDistricts,
        dailyCapacity: t.dailyCapacity,
        userId,
      },
    });
    const list = techsByBranch.get(t.branch) ?? [];
    list.push({ id: row.id, userId, districts: t.serviceDistricts });
    techsByBranch.set(t.branch, list);
  }

  // ── catalogue ──
  const vehicles: VehicleModel[] = [];
  for (const [i, v] of VEHICLE_MODELS.entries()) {
    vehicles.push(await prisma.vehicleModel.create({ data: { ...v, sortOrder: i } }));
  }
  const batteries: Battery[] = [];
  for (const b of BATTERIES) batteries.push(await prisma.battery.create({ data: b }));
  await prisma.batteryCompatibility.createMany({
    data: vehicles.flatMap((v) =>
      batteries
        .filter((b) => b.groupSize === v.groupSize)
        .map((b) => ({ vehicleModelId: v.id, batteryId: b.id, matchesFactorySpec: b.capacityAh === v.factoryAh })),
    ),
  });
  const fitting = (vehicleId: string) => {
    const v = vehicles.find((x) => x.id === vehicleId)!;
    return batteries.filter((b) => b.groupSize === v.groupSize);
  };
  const sellableVehicles = vehicles.filter((v) => fitting(v.id).length > 0);

  const channels = [];
  for (const [i, { weight, ...c }] of CHANNELS.entries()) {
    channels.push({ ...(await prisma.channel.create({ data: { ...c, sortOrder: i } })), weight });
  }
  const slots: ServiceSlot[] = [];
  for (const [i, s] of SLOTS.entries()) slots.push(await prisma.serviceSlot.create({ data: { ...s, sortOrder: i } }));

  // ── customers ──
  const customers = [];
  const usedPhones = new Set<string>();
  for (let i = 0; i < 32; i++) {
    let phone: string;
    do phone = `09${pick(['12', '19', '35', '36', '01', '02'])}${String(int(0, 9_999_999)).padStart(7, '0')}`;
    while (usedPhones.has(phone));
    usedPhones.add(phone);
    customers.push(
      await prisma.customer.create({
        data: { phone, fullName: `${pick(CUSTOMER_FIRST_NAMES)} ${pick(CUSTOMER_LAST_NAMES)}` },
      }),
    );
  }

  // ── orders ──
  const today = tehranDate(NOW);
  const slotStart = (date: Date, s: (typeof slots)[number]) => atTehran(date, s.startTime);
  const slotEnd = (date: Date, s: (typeof slots)[number]) => atTehran(date, s.endTime);
  const finishedToday = slots.filter((s) => slotEnd(today, s) <= NOW);
  const startedToday = slots.filter((s) => slotStart(today, s) <= NOW);
  const upcomingToday = slots.filter((s) => slotStart(today, s) > NOW);

  const reserved = new Map<string, number>(); // `${branchId}:${batteryId}` → count
  const issued = new Map<string, number>();
  const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
  const movements: {
    branchId: string; batteryId: string; type: 'RECEIPT' | 'RESERVE' | 'RELEASE' | 'ISSUE' | 'TRANSFER';
    quantity: number; orderId?: string; actorUserId?: string | null; createdAt: Date; note?: string; reference?: string;
  }[] = [];
  let discrepancyPlanted = false;
  let demoTechFinishedToday = 0;

  for (const plan of PLAN) {
    const { status } = plan;
    const branchCode: BranchCode = plan.branch ?? (chance(0.55) ? 'WEST' : 'EAST');
    const branch = BRANCHES.find((b) => b.code === branchCode)!;
    const branchId = branches.get(branchCode)!;
    const vehicle = pick(sellableVehicles);
    const fits = fitting(vehicle.id);
    const battery = chance(0.6) ? (fits.find((b) => b.capacityAh === vehicle.factoryAh) ?? pick(fits)) : pick(fits);
    const channel = weighted(channels);
    const customer = pick(customers);
    const operatorId = branchCode === 'WEST' ? users.get('OPERATOR')! : users.get('SUPER_ADMIN')!;
    const managerId = branchCode === 'WEST' ? users.get('BRANCH_MANAGER')! : users.get('SUPER_ADMIN')!;
    const team = techsByBranch.get(branchCode)!;
    // Demo technician: today's live WEST jobs plus one finished this morning (5 of 6, like the design).
    const liveWest =
      plan.when === 'today' &&
      branchCode === 'WEST' &&
      status !== 'CREATED' &&
      (status !== 'COMPLETED' || demoTechFinishedToday++ === 0);
    const tech = liveWest ? team.find((t) => t.userId)! : pick(team);
    const district = liveWest ? pick(tech.districts) : pick(branch.serviceDistricts);

    // Schedule and timestamps.
    let scheduledDate: Date;
    let slot: (typeof slots)[number];
    let createdAt: number;
    if (plan.when === 'past') {
      createdAt = NOW - int(2 * DAY, 30 * DAY);
      scheduledDate = tehranDate(createdAt + DAY);
      slot = pick(slots);
    } else if (plan.when === 'tomorrow') {
      createdAt = NOW - int(1 * HOUR, 6 * HOUR);
      scheduledDate = tehranDate(NOW + DAY);
      slot = pick(slots);
    } else {
      createdAt = NOW - int(18 * HOUR, 30 * HOUR);
      scheduledDate = today;
      const done = status === 'COMPLETED' || status === 'CANCELLED';
      // Finished jobs sit in slots that are over; live ones in a started slot; CREATED in an upcoming one.
      slot = done
        ? (pick(finishedToday.length ? finishedToday : slots.slice(0, 1)))
        : status === 'CREATED'
          ? (upcomingToday[0] ?? slots.at(-1)!)
          : (startedToday.at(-1) ?? slots[0]!);
      if (done && !finishedToday.length) scheduledDate = tehranDate(NOW - DAY); // early-morning seed run
    }

    const steps: OrderStatus[] =
      status === 'CANCELLED'
        ? [...PATH.slice(0, PATH.indexOf(chance(0.5) ? 'CREATED' : 'ASSIGNED') + 1), 'CANCELLED']
        : PATH.slice(0, PATH.indexOf(status) + 1);

    const times: number[] = [createdAt];
    const start = slotStart(scheduledDate, slot);
    if (status === 'COMPLETED' || (status === 'CANCELLED' && plan.when === 'past')) {
      const at: Partial<Record<OrderStatus, number>> = {
        ASSIGNED: createdAt + int(20, 180) * MIN,
        ACCEPTED: createdAt + int(181, 300) * MIN,
        EN_ROUTE: start + int(0, 20) * MIN,
        ON_SITE: start + int(35, 70) * MIN,
        INSTALLING: start + int(75, 85) * MIN,
        COMPLETED: start + int(100, 130) * MIN,
        CANCELLED: createdAt + int(1, 10) * HOUR,
      };
      for (const s of steps.slice(1)) times.push(Math.min(at[s]!, NOW - 5 * MIN));
    } else {
      // In-flight (or cancelled today): spread events between creation and a few minutes ago.
      const n = steps.length - 1;
      const end = NOW - int(5, 20) * MIN;
      for (let i = 1; i <= n; i++) times.push(createdAt + ((end - createdAt) * i) / n);
    }
    const at = (s: OrderStatus) => new Date(times[steps.indexOf(s)]!);
    const reached = (s: OrderStatus) => steps.includes(s);

    // Price: estimate at order time, actual at completion.
    const withCore = chance(0.9);
    const estimate = quote(battery, withCore);
    let price = { ...estimate };
    let coreAh: number | null = estimate.estimatedCoreAh;
    if (status === 'COMPLETED') {
      const returned = withCore && chance(0.9);
      coreAh = returned
        ? Math.min(BUSINESS_RULES.coreAhMax, Math.max(BUSINESS_RULES.coreAhMin, battery.capacityAh + pick([-15, -10, -5, 0, 0, 0, 5])))
        : null;
      price = { ...breakdown(battery.priceRial, BUSINESS_RULES.installFeeRial, coreAh), estimatedCoreAh: estimate.estimatedCoreAh };
    }
    // One recent settlement mismatch for the dashboard alert.
    const plantMismatch = status === 'COMPLETED' && plan.when === 'today' && !discrepancyPlanted;
    if (plantMismatch) discrepancyPlanted = true;
    const received = plantMismatch ? price.totalRial - 2_250_000n : price.totalRial;

    const actorFor = (s: OrderStatus): string | null => {
      if (s === 'CREATED') return channel.code === 'WEBSITE' ? null : operatorId;
      if (['ACCEPTED', 'EN_ROUTE', 'ON_SITE', 'INSTALLING', 'COMPLETED'].includes(s)) return tech.userId;
      if (s === 'CANCELLED') return managerId;
      return operatorId;
    };
    const branchNote = reached('ASSIGNED') && chance(0.4) ? pick(BRANCH_NOTES) : null;
    const createdDate = new Date(createdAt);

    const order = await prisma.order.create({
      data: {
        code: orderCode(createdDate, (max) => Math.floor(rand() * max)),
        idempotencyKey: `seed-${crypto.randomUUID()}`,
        status,
        customerId: customer.id,
        branchId,
        channelId: channel.id,
        vehicleModelId: vehicle.id,
        batteryId: battery.id,
        slotId: slot.id,
        scheduledDate,
        district,
        address: `${pick(STREETS)}، کوچه ${toPersianDigits(int(1, 40))}، پلاک ${toPersianDigits(int(1, 120))}`,
        installLocation: weighted(LOCATIONS).value,
        branchNote,
        estimatedCoreAh: estimate.estimatedCoreAh,
        batteryPriceRial: price.batteryPriceRial,
        installFeeRial: price.installFeeRial,
        coreCreditRial: price.coreCreditRial,
        totalRial: price.totalRial,
        batteryCostRial: battery.costRial,
        createdById: actorFor('CREATED'),
        cancelReason: status === 'CANCELLED' ? pick(CANCEL_REASONS) : null,
        cancelledAt: status === 'CANCELLED' ? at('CANCELLED') : null,
        completedAt: status === 'COMPLETED' ? at('COMPLETED') : null,
        createdAt: createdDate,
        events: {
          create: [
            ...steps.map((s, i) => ({
              kind: 'STATUS' as const,
              fromStatus: i === 0 ? null : steps[i - 1]!,
              toStatus: s,
              actorUserId: actorFor(s),
              createdAt: at(s),
              data: s === 'ASSIGNED' ? { technicianId: tech.id } : undefined,
              note: s === 'CANCELLED' ? 'لغو توسط شعبه' : undefined,
            })),
            ...(branchNote
              ? [{ kind: 'NOTE' as const, actorUserId: managerId, createdAt: at('ASSIGNED'), data: { from: null, to: branchNote } }]
              : []),
          ],
        },
        mission: reached('ASSIGNED')
          ? {
              create: {
                technicianId: tech.id,
                assignedAt: at('ASSIGNED'),
                acceptedAt: reached('ACCEPTED') ? at('ACCEPTED') : null,
                departedAt: reached('EN_ROUTE') ? at('EN_ROUTE') : null,
                arrivedAt: reached('ON_SITE') ? at('ON_SITE') : null,
                startedAt: reached('INSTALLING') ? at('INSTALLING') : null,
                installedAt: reached('COMPLETED') ? at('COMPLETED') : null,
                installedSerial: reached('COMPLETED') ? `${battery.sku.replace('-', '')}-${int(1000, 9999)}-${int(100000, 999999)}` : null,
              },
            }
          : undefined,
        coreReturn:
          status === 'COMPLETED'
            ? {
                create: {
                  returned: coreAh !== null,
                  ampereHours: coreAh,
                  creditAppliedRial: price.coreCreditRial,
                  scrapValueRial: coreScrapValue(coreAh),
                  recordedAt: at('COMPLETED'),
                },
              }
            : undefined,
        payments:
          status === 'COMPLETED'
            ? {
                create: {
                  amountRial: received,
                  expectedRial: price.totalRial,
                  method: weighted(PAYMENT_METHODS).value,
                  status: 'PAID',
                  reference: String(int(100000, 999999)),
                  receivedById: tech.userId,
                  paidAt: at('COMPLETED'),
                  createdAt: at('COMPLETED'),
                },
              }
            : undefined,
      },
    });

    const key = `${branchId}:${battery.id}`;
    movements.push({ branchId, batteryId: battery.id, type: 'RESERVE', quantity: 1, orderId: order.id, actorUserId: actorFor('CREATED'), createdAt: at('CREATED') });
    if (status === 'CANCELLED') {
      movements.push({ branchId, batteryId: battery.id, type: 'RELEASE', quantity: -1, orderId: order.id, actorUserId: managerId, createdAt: at('CANCELLED') });
    } else if (status === 'COMPLETED') {
      bump(issued, key);
      movements.push({ branchId, batteryId: battery.id, type: 'ISSUE', quantity: -1, orderId: order.id, actorUserId: tech.userId, createdAt: at('COMPLETED') });
    } else if (HOLDS_STOCK.includes(status)) {
      bump(reserved, key);
    }
  }

  // ── stock: free stock from seed-data + live reservations; opening receipt covers issued units ──
  // Today's warehouse work, so the ledger shows every row type: a receipt and a transfer east → west.
  const sku = (code: string) => batteries.find((b) => b.sku === code)!.id;
  const westId = branches.get('WEST')!;
  const eastId = branches.get('EAST')!;
  const manager = users.get('BRANCH_MANAGER')!;
  const todayWork: typeof movements = [
    { branchId: westId, batteryId: sku('SAB-60'), type: 'RECEIPT', quantity: 10, actorUserId: manager, createdAt: new Date(NOW - 3 * HOUR), reference: documentCode('RCV', new Date(NOW), (m) => Math.floor(rand() * m)) },
    ...((): typeof movements => {
      const reference = documentCode('TRF', new Date(NOW), (m) => Math.floor(rand() * m));
      const at = new Date(NOW - 2 * HOUR);
      return [
        { branchId: eastId, batteryId: sku('NIR-66'), type: 'TRANSFER', quantity: -2, actorUserId: users.get('SUPER_ADMIN')!, createdAt: at, reference, note: 'به شعبه غرب' },
        { branchId: westId, batteryId: sku('NIR-66'), type: 'TRANSFER', quantity: 2, actorUserId: users.get('SUPER_ADMIN')!, createdAt: at, reference, note: 'از شعبه شرق' },
      ];
    })(),
  ];
  /** Reorder point per SKU (fast movers higher). */
  const REORDER: Record<string, number> = { 'SAB-60': 10, 'SAB-50': 8, 'ATL-60': 5, 'SAB-74': 5 };
  for (const b of BRANCHES) {
    const branchId = branches.get(b.code)!;
    for (const battery of batteries) {
      const key = `${branchId}:${battery.id}`;
      const res = reserved.get(key) ?? 0;
      const onHand = FREE_STOCK[b.code][battery.sku]! + res;
      await prisma.stock.create({
        data: { branchId, batteryId: battery.id, onHand, reserved: res, reorderPoint: REORDER[battery.sku] ?? 4 },
      });
      // Opening balance = today's on hand + everything issued − today's receipts/transfers in.
      const later = todayWork.filter((m) => m.branchId === branchId && m.batteryId === battery.id).reduce((t, m) => t + m.quantity, 0);
      movements.push({
        branchId, batteryId: battery.id, type: 'RECEIPT', quantity: onHand + (issued.get(key) ?? 0) - later,
        actorUserId: users.get('SUPER_ADMIN')!, createdAt: new Date(NOW - 35 * DAY), note: 'موجودی اولیه',
        reference: documentCode('RCV', new Date(NOW - 35 * DAY), (m) => Math.floor(rand() * m)),
      });
    }
  }
  movements.push(...todayWork);
  await prisma.stockMovement.createMany({ data: movements });

  const counts = await prisma.order.groupBy({ by: ['status'], _count: true });
  console.log('Seeded:', {
    branches: branches.size,
    users: DEMO_USERS.length,
    technicians: TECHNICIANS.length,
    vehicles: vehicles.length,
    batteries: batteries.length,
    channels: channels.length,
    slots: slots.length,
    customers: customers.length,
    orders: Object.fromEntries(counts.map((c) => [c.status, c._count])),
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
