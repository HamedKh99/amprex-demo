/**
 * Demo seed: wipes all data and recreates it deterministically (fixed PRNG seed).
 * Order timestamps are relative to "now", so the dashboard always looks recent.
 *   pnpm db:seed
 */
import { config } from 'dotenv';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  type CoreCondition,
  type OrderStatus,
  type PaymentMethod,
  PrismaClient,
} from '../src/generated/prisma/client.js';
import { BUSINESS_RULES } from '../src/config/business-rules.js';
import {
  BATTERIES,
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

const PATH: OrderStatus[] = ['CREATED', 'ASSIGNED', 'EN_ROUTE', 'ON_SITE', 'INSTALLED', 'PAID', 'COMPLETED'];
const ACTIVE: OrderStatus[] = ['CREATED', 'ASSIGNED', 'EN_ROUTE', 'ON_SITE']; // hold a reservation
const ISSUED: OrderStatus[] = ['INSTALLED', 'PAID', 'COMPLETED']; // battery left the shelf

/** Final status of each of the 40 seeded orders. */
const FINAL_STATUSES: OrderStatus[] = [
  ...Array<OrderStatus>(26).fill('COMPLETED'),
  ...Array<OrderStatus>(4).fill('CANCELLED'),
  'PAID', 'PAID',
  'INSTALLED', 'INSTALLED',
  'ON_SITE', 'EN_ROUTE',
  'ASSIGNED', 'ASSIGNED',
  'CREATED', 'CREATED',
];

const PAYMENT_METHODS: { value: PaymentMethod; weight: number }[] = [
  { value: 'CARD_POS', weight: 55 },
  { value: 'CARD_TO_CARD', weight: 20 },
  { value: 'CASH', weight: 15 },
  { value: 'ONLINE', weight: 10 },
];

const CANCEL_REASONS = ['انصراف مشتری', 'عدم پاسخگویی مشتری', 'خودرو در محل نبود', 'خرید از جای دیگر'];

async function wipe() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE "Payment", "CoreReturn", "Mission", "OrderEvent", "StockMovement", "Order",
             "Customer", "Stock", "BatteryCompatibility", "Battery", "VehicleModel",
             "Technician", "User", "Branch", "Channel", "ServiceSlot" CASCADE`);
  // Order numbers start at 1001.
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

  const techsByBranch = new Map<BranchCode, { id: string; userId: string | null }[]>();
  for (const t of TECHNICIANS) {
    const userId = t.demoUser ? users.get('TECHNICIAN')! : null;
    const row = await prisma.technician.create({
      data: { branchId: branches.get(t.branch)!, fullName: t.fullName, phone: t.phone, userId },
    });
    techsByBranch.set(t.branch, [...(techsByBranch.get(t.branch) ?? []), { id: row.id, userId }]);
  }

  // ── catalogue ──
  const vehicles = await Promise.all(
    VEHICLE_MODELS.map(({ size: _size, ...v }, i) =>
      prisma.vehicleModel.create({ data: { ...v, sortOrder: i } }).then((row) => ({ ...row, size: _size })),
    ),
  );
  const batteries = await Promise.all(
    BATTERIES.map(({ size, recommended, ...b }) =>
      prisma.battery.create({ data: b }).then((row) => ({ ...row, size, recommended: !!recommended })),
    ),
  );
  await prisma.batteryCompatibility.createMany({
    data: vehicles.flatMap((v) =>
      batteries
        .filter((b) => b.size === v.size)
        .map((b) => ({ vehicleModelId: v.id, batteryId: b.id, isRecommended: b.recommended })),
    ),
  });

  const channels = await Promise.all(
    CHANNELS.map(({ weight, ...c }, i) =>
      prisma.channel.create({ data: { ...c, sortOrder: i } }).then((row) => ({ ...row, weight })),
    ),
  );
  const slots = await Promise.all(
    SLOTS.map((s, i) => prisma.serviceSlot.create({ data: { ...s, sortOrder: i } })),
  );

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
  const reserved = new Map<string, number>(); // `${branchId}:${batteryId}` → count
  const issued = new Map<string, number>();
  const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
  const movements: {
    branchId: string; batteryId: string; type: 'RECEIPT' | 'RESERVE' | 'RELEASE' | 'ISSUE';
    quantity: number; orderId?: string; actorUserId?: string | null; createdAt: Date; note?: string;
  }[] = [];

  // Shuffle so statuses are spread over branches/channels, then sort by creation time.
  const plan = FINAL_STATUSES.map((status) => ({ status, key: rand() })).sort((a, b) => a.key - b.key);

  const orderSpecs = plan.map(({ status }) => {
    const branchCode: BranchCode = chance(0.55) ? 'WEST' : 'EAST';
    const isActive = ACTIVE.includes(status) || status === 'INSTALLED' || status === 'PAID';
    // Terminal orders: created 2–30 days ago. In-flight: created within the last day.
    const createdAt = isActive ? NOW - int(2 * HOUR, 20 * HOUR) : NOW - int(2 * DAY, 30 * DAY);
    return { status, branchCode, createdAt };
  });
  orderSpecs.sort((a, b) => a.createdAt - b.createdAt);

  for (const spec of orderSpecs) {
    const { status, branchCode } = spec;
    const branch = BRANCHES.find((b) => b.code === branchCode)!;
    const branchId = branches.get(branchCode)!;
    const vehicle = pick(vehicles);
    const compatible = batteries.filter((b) => b.size === vehicle.size);
    // Prefer the recommended battery ~60% of the time.
    const battery = chance(0.6) ? compatible.find((b) => b.recommended)! : pick(compatible);
    const channel = weighted(channels);
    const slot = pick(slots);
    const customer = pick(customers);
    const district = pick(branch.serviceDistricts);
    const operatorId = branchCode === 'WEST' ? users.get('OPERATOR')! : users.get('SUPER_ADMIN')!;
    const managerId = branchCode === 'WEST' ? users.get('BRANCH_MANAGER')! : users.get('SUPER_ADMIN')!;
    const tech =
      ACTIVE.includes(status) && branchCode === 'WEST'
        ? techsByBranch.get('WEST')!.find((t) => t.userId)! // demo technician gets the live missions
        : pick(techsByBranch.get(branchCode)!);

    // Price (same formula the API will use).
    const coreReturnExpected = chance(0.85);
    const installFee = BUSINESS_RULES.installFeeRial;
    const estimatedCredit = coreReturnExpected ? battery.coreCreditRial : 0n;

    // Status path and timestamps.
    const cancelAfter: OrderStatus = chance(0.5) ? 'CREATED' : 'ASSIGNED';
    const steps: OrderStatus[] =
      status === 'CANCELLED'
        ? [...PATH.slice(0, PATH.indexOf(cancelAfter) + 1), 'CANCELLED']
        : PATH.slice(0, PATH.indexOf(status) + 1);

    let scheduledDate: Date;
    const times: number[] = [spec.createdAt];
    if (ACTIVE.includes(status) || status === 'INSTALLED' || status === 'PAID') {
      // In-flight: CREATED is booked for tomorrow; others are today's jobs, events end shortly before now.
      scheduledDate = tehranDate(status === 'CREATED' ? NOW + DAY : NOW);
      const n = steps.length - 1;
      for (let i = 1; i <= n; i++) times.push(spec.createdAt + ((NOW - int(5, 25) * MIN - spec.createdAt) * i) / n);
    } else {
      scheduledDate = tehranDate(spec.createdAt + DAY);
      const start = atTehran(scheduledDate, slot.startTime);
      const offsets: Partial<Record<OrderStatus, number>> = {
        ASSIGNED: spec.createdAt + int(20, 180) * MIN,
        EN_ROUTE: start + int(0, 30) * MIN,
        ON_SITE: start + int(40, 80) * MIN,
        INSTALLED: start + int(90, 120) * MIN,
        PAID: start + int(121, 130) * MIN,
        COMPLETED: start + int(3, 6) * HOUR,
        CANCELLED: spec.createdAt + int(1, 12) * HOUR,
      };
      for (const s of steps.slice(1)) times.push(offsets[s]!);
    }
    const at = (s: OrderStatus) => new Date(times[steps.indexOf(s)]!);
    const reached = (s: OrderStatus) => steps.includes(s);

    // Core return outcome (recorded at INSTALLED).
    let coreCondition: CoreCondition | null = null;
    let credit = estimatedCredit;
    if (reached('INSTALLED')) {
      coreCondition = !coreReturnExpected
        ? 'NOT_RETURNED'
        : weighted([
            { v: 'INTACT' as const, weight: 85 },
            { v: 'DAMAGED' as const, weight: 10 },
            { v: 'NOT_RETURNED' as const, weight: 5 },
          ]).v;
      credit = (battery.coreCreditRial * BigInt(BUSINESS_RULES.coreCreditPercent[coreCondition])) / 100n;
    }
    const total = battery.priceRial + installFee - credit;

    const actorFor = (s: OrderStatus): string | null => {
      if (s === 'CREATED') return channel.code === 'WEBSITE' ? null : operatorId;
      if (['EN_ROUTE', 'ON_SITE', 'INSTALLED', 'PAID'].includes(s)) return tech.userId;
      if (s === 'COMPLETED') return managerId;
      return operatorId;
    };

    const order = await prisma.order.create({
      data: {
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
        address: `تهران، منطقه ${district}، ${pick(STREETS)}، کوچه ${int(1, 40)}، پلاک ${int(1, 120)}`,
        coreReturnExpected,
        batteryPriceRial: battery.priceRial,
        installFeeRial: installFee,
        coreCreditRial: credit,
        totalRial: total,
        createdById: actorFor('CREATED'),
        cancelReason: status === 'CANCELLED' ? pick(CANCEL_REASONS) : null,
        cancelledAt: status === 'CANCELLED' ? at('CANCELLED') : null,
        completedAt: status === 'COMPLETED' ? at('COMPLETED') : null,
        createdAt: at('CREATED'),
        events: {
          create: steps.map((s, i) => ({
            fromStatus: i === 0 ? null : steps[i - 1]!,
            toStatus: s,
            actorUserId: actorFor(s),
            createdAt: at(s),
            data: s === 'ASSIGNED' ? { technicianId: tech.id } : undefined,
            note: s === 'CANCELLED' ? 'لغو توسط اپراتور' : undefined,
          })),
        },
        mission: reached('ASSIGNED')
          ? {
              create: {
                technicianId: tech.id,
                assignedAt: at('ASSIGNED'),
                departedAt: reached('EN_ROUTE') ? at('EN_ROUTE') : null,
                arrivedAt: reached('ON_SITE') ? at('ON_SITE') : null,
                installedAt: reached('INSTALLED') ? at('INSTALLED') : null,
                installedSerial: reached('INSTALLED') ? `${battery.sku}-${int(100000, 999999)}` : null,
              },
            }
          : undefined,
        coreReturn: coreCondition
          ? {
              create: {
                condition: coreCondition,
                oldBatteryNote: coreCondition === 'NOT_RETURNED' ? null : `${pick(['صبا', 'نیرو', 'اطلس', 'سپاهان'])} ${pick([45, 50, 55, 60, 66, 70])} آمپر`,
                creditAppliedRial: credit,
                recordedAt: at('INSTALLED'),
              },
            }
          : undefined,
        payments: reached('PAID')
          ? {
              create: {
                amountRial: total,
                method: weighted(PAYMENT_METHODS.map((m) => ({ ...m }))).value,
                status: 'PAID',
                reference: String(int(100000000, 999999999)),
                receivedById: tech.userId,
                paidAt: at('PAID'),
                createdAt: at('PAID'),
              },
            }
          : undefined,
      },
    });

    const key = `${branchId}:${battery.id}`;
    const actor = actorFor('CREATED');
    movements.push({ branchId, batteryId: battery.id, type: 'RESERVE', quantity: 1, orderId: order.id, actorUserId: actor, createdAt: at('CREATED') });
    if (status === 'CANCELLED') {
      movements.push({ branchId, batteryId: battery.id, type: 'RELEASE', quantity: -1, orderId: order.id, actorUserId: operatorId, createdAt: at('CANCELLED') });
    } else if (ISSUED.includes(status)) {
      bump(issued, key);
      movements.push({ branchId, batteryId: battery.id, type: 'ISSUE', quantity: -1, orderId: order.id, actorUserId: tech.userId, createdAt: at('INSTALLED') });
    } else {
      bump(reserved, key);
    }
  }

  // ── stock: free stock from seed-data + live reservations; opening receipt covers issued units ──
  for (const b of BRANCHES) {
    const branchId = branches.get(b.code)!;
    for (const battery of batteries) {
      const key = `${branchId}:${battery.id}`;
      const res = reserved.get(key) ?? 0;
      const onHand = FREE_STOCK[b.code][battery.sku]! + res;
      await prisma.stock.create({ data: { branchId, batteryId: battery.id, onHand, reserved: res } });
      movements.push({
        branchId, batteryId: battery.id, type: 'RECEIPT', quantity: onHand + (issued.get(key) ?? 0),
        actorUserId: users.get('SUPER_ADMIN')!, createdAt: new Date(NOW - 35 * DAY), note: 'موجودی اولیه',
      });
    }
  }
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
