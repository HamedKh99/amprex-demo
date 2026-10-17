import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/* Acceptance path over HTTP against the seeded demo data (see test/global-setup.ts). */

let app: INestApplication;
let prisma: PrismaService;
const token: Record<'admin' | 'manager' | 'operator' | 'tech', string> = {
  admin: '',
  manager: '',
  operator: '',
  tech: '',
};
const api = () => request(app.getHttpServer());
const as = (who: keyof typeof token) => ({ Authorization: `Bearer ${token[who]}` });
const phone = () => `0935${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = configureApp(moduleRef.createNestApplication());
  await app.init();
  prisma = app.get(PrismaService);

  const logins = { admin: '09120000001', manager: '09120000002', operator: '09120000003', tech: '09120000004' };
  for (const [who, p] of Object.entries(logins)) {
    const res = await api()
      .post('/api/auth/login')
      .send({ phone: p, password: process.env.SEED_DEMO_PASSWORD })
      .expect(200);
    token[who as keyof typeof token] = res.body.accessToken;
  }
});

afterAll(async () => {
  await app?.close();
});

interface Booking {
  vehicleModelId: string;
  batteryId: string;
  district: number;
  scheduledDate: string;
  slotId: string;
  battery: { sku: string; capacityAh: number; inStock: boolean; price: { totalRial: string; batteryPriceRial: string } };
}

/** Picks vehicle / battery / day / slot the way the site does, using only API answers. Skips today. */
async function planBooking(district: number, vehicleCode: string, sku?: string, minRemaining = 1): Promise<Booking> {
  const vehicles = (await api().get('/api/catalog/vehicles').expect(200)).body;
  const vehicle = vehicles.find((v: { code: string }) => v.code === vehicleCode);
  const fit = (await api().get(`/api/catalog/vehicles/${vehicle.id}/batteries?district=${district}`).expect(200)).body;
  const battery = sku
    ? fit.batteries.find((b: { sku: string }) => b.sku === sku)
    : fit.batteries.find((b: { inStock: boolean }) => b.inStock);
  const avail = (await api().get(`/api/lookups/availability?district=${district}`).expect(200)).body;
  for (const day of avail.days.filter((d: { isToday: boolean }) => !d.isToday)) {
    const slot = day.slots.find((s: { state: string; remaining: number }) => s.state === 'OPEN' && s.remaining >= minRemaining);
    if (slot) {
      return { vehicleModelId: vehicle.id, batteryId: battery.id, district, scheduledDate: day.date, slotId: slot.id, battery };
    }
  }
  throw new Error('no free slot in the booking window');
}

function orderBody(b: Booking) {
  return {
    customerName: 'مشتری آزمون',
    customerPhone: phone(),
    vehicleModelId: b.vehicleModelId,
    batteryId: b.batteryId,
    district: b.district,
    address: `تهران، منطقه ${b.district}، خیابان آزمون، پلاک ۱`,
    installLocation: 'PARKING',
    scheduledDate: b.scheduledDate,
    slotId: b.slotId,
  };
}

const place = async (b: Booking) =>
  (await api().post('/api/orders').set('Idempotency-Key', randomUUID()).send(orderBody(b)).expect(201)).body;

async function stockOf(branchId: string, batteryId: string) {
  return prisma.stock.findUniqueOrThrow({ where: { branchId_batteryId: { branchId, batteryId } } });
}

/** Operator assigns the demo technician (the only one with a login). */
async function assignDemoTech(orderId: string) {
  const options = (await api().get(`/api/orders/${orderId}/technicians`).set(as('operator')).expect(200)).body;
  const demo = options.find((t: { userId: string | null }) => t.userId);
  return api().post(`/api/orders/${orderId}/assign`).set(as('operator')).send({ technicianId: demo.id, note: 'قبل از حرکت تماس گرفته شود.' });
}

async function runToInstalling(orderId: string) {
  for (const step of ['accept', 'depart', 'arrive', 'start']) {
    await api().post(`/api/missions/${orderId}/${step}`).set(as('tech')).expect(200);
  }
}

describe('order → assign → mission → finish & settle → report', () => {
  it('requires an Idempotency-Key', async () => {
    const b = await planBooking(5, 'P206');
    const res = await api().post('/api/orders').send(orderBody(b)).expect(400);
    expect(res.body.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('runs the full acceptance path', async () => {
    // 1) Customer orders on the site: estimate assumes an old battery of the same Ah.
    const b = await planBooking(5, 'P206', 'SAB-60');
    const body = orderBody(b);
    const key = randomUUID();
    const order = (await api().post('/api/orders').set('Idempotency-Key', key).send(body).expect(201)).body;
    expect(order.code).toMatch(/^AMX-\d{6}-[A-Z2-9]{4}$/);
    expect(order.status).toBe('CREATED');
    expect(order.channel.code).toBe('WEBSITE');
    expect(order.installFeeRial).toBe('0');
    expect(order.estimatedCoreAh).toBe(60);
    expect(order.totalRial).toBe(b.battery.price.totalRial);

    const again = await api().post('/api/orders').set('Idempotency-Key', key).send(body).expect(200);
    expect(again.body.id).toBe(order.id);
    const afterReserve = await stockOf(order.branch.id, b.batteryId);

    // 2) Assignment with a branch note.
    const assigned = await assignDemoTech(order.id);
    expect(assigned.status).toBe(200);
    expect(assigned.body.status).toBe('ASSIGNED');
    expect(assigned.body.branchNote).toBe('قبل از حرکت تماس گرفته شود.');

    // 3) Technician: five steps, with a live settlement quote for a 45 Ah old battery.
    const upcoming = (await api().get('/api/missions?view=upcoming').set(as('tech')).expect(200)).body;
    expect(upcoming.find((m: { id: string }) => m.id === order.id).allowedTransitions).toEqual(['ACCEPTED']);
    await runToInstalling(order.id);

    const quote = (
      await api().get(`/api/missions/${order.id}/settlement?coreReturned=true&oldBatteryAh=45`).set(as('tech')).expect(200)
    ).body;
    // ۴٬۸۵۰٬۰۰۰ − ۴۵ × ۱۵٬۰۰۰ = ۴٬۱۷۵٬۰۰۰ تومان; ۲۲۵٬۰۰۰ تومان above the ۳٬۹۵۰٬۰۰۰ estimate.
    expect(quote.totalRial).toBe('41750000');
    expect(quote.differenceRial).toBe('2250000');
    await api().get(`/api/missions/${order.id}/settlement?coreReturned=true&oldBatteryAh=400`).set(as('tech')).expect(400);

    const done = (
      await api()
        .post(`/api/missions/${order.id}/finish`)
        .set(as('tech'))
        .send({ installedSerial: 'SB60-2405-118734', coreReturned: true, oldBatteryAh: 45, receivedRial: '41750000', method: 'CARD_POS' })
        .expect(200)
    ).body;
    expect(done.status).toBe('COMPLETED');
    expect(done.totalRial).toBe('41750000');
    expect(done.coreReturn).toMatchObject({ returned: true, ampereHours: 45, creditAppliedRial: '6750000' });
    expect(done.payments[0]).toMatchObject({ amountRial: '41750000', expectedRial: '41750000', method: 'CARD_POS' });
    expect(done.events.filter((e: { kind: string }) => e.kind === 'STATUS').map((e: { toStatus: string }) => e.toStatus)).toEqual([
      'CREATED', 'ASSIGNED', 'ACCEPTED', 'EN_ROUTE', 'ON_SITE', 'INSTALLING', 'COMPLETED',
    ]);
    expect(done.events.some((e: { kind: string }) => e.kind === 'NOTE')).toBe(true);

    const afterIssue = await stockOf(order.branch.id, b.batteryId);
    expect(afterIssue.onHand).toBe(afterReserve.onHand - 1);
    expect(afterIssue.reserved).toBe(afterReserve.reserved - 1);

    // 4) Customer tracking by code + phone.
    const tracked = (await api().get(`/api/orders/track?code=${order.code}&phone=${body.customerPhone}`).expect(200)).body;
    expect(tracked.milestones.every((m: { state: string }) => m.state === 'DONE')).toBe(true);
    await api().get(`/api/orders/track?code=${order.code}&phone=09350000000`).expect(404);

    // 5) Managers see profit; operators do not.
    const asManager = (await api().get(`/api/orders/${order.id}`).set(as('manager')).expect(200)).body;
    // ۴٬۱۷۵٬۰۰۰ − ۳٬۵۵۰٬۰۰۰ + ۴۵ × ۷٬۵۰۰ = ۹۶۲٬۵۰۰ تومان
    expect(asManager.financials).toMatchObject({ grossProfitRial: '9625000', isEstimate: false });
    const asOperator = (await api().get(`/api/orders/${order.id}`).set(as('operator')).expect(200)).body;
    expect(asOperator.financials).toBeNull();
    expect(asOperator.batteryCostRial).toBeUndefined();

    const report = (await api().get('/api/reports/summary').set(as('manager')).expect(200)).body;
    expect(report.kpis.completed).toBeGreaterThan(0);
    expect(BigInt(report.kpis.grossProfitRial)).toBeGreaterThan(0n);
  });

  it('records a settlement mismatch and raises it on the dashboard', async () => {
    const b = await planBooking(5, 'P206', 'SAB-60');
    const order = await place(b);
    expect((await assignDemoTech(order.id)).status).toBe(200);
    await runToInstalling(order.id);
    await api()
      .post(`/api/missions/${order.id}/finish`)
      .set(as('tech'))
      .send({ installedSerial: 'SB60-0000-000001', coreReturned: false, receivedRial: '46250000', method: 'CASH' })
      .expect(200);

    const dash = (await api().get('/api/dashboard').set(as('manager')).expect(200)).body;
    const alert = dash.alerts.find((a: { type: string; code?: string }) => a.type === 'SETTLEMENT_MISMATCH' && a.code === order.code);
    expect(alert.differenceRial).toBe('2250000');
    expect(dash.technicians.length).toBeGreaterThan(0);
    expect(dash.kpis.grossProfitRial).not.toBeNull();
    expect((await api().get('/api/dashboard').set(as('operator')).expect(200)).body.kpis.grossProfitRial).toBeNull();
  });
});

describe('business rules', () => {
  it('rejects an out-of-stock battery with 409 OUT_OF_STOCK', async () => {
    // Seed: EAST branch has no ATL-74; district 4 is served by EAST.
    const b = await planBooking(4, 'CERATO', 'ATL-74');
    expect(b.battery.inStock).toBe(false);
    const res = await api().post('/api/orders').set('Idempotency-Key', randomUUID()).send(orderBody(b)).expect(409);
    expect(res.body.code).toBe('OUT_OF_STOCK');
  });

  it('hides out-of-stock batteries when asked and reports none for motorcycles', async () => {
    const vehicles = (await api().get('/api/catalog/vehicles?type=MOTORCYCLE').expect(200)).body;
    expect(vehicles.length).toBeGreaterThan(0);
    const fit = (await api().get(`/api/catalog/vehicles/${vehicles[0].id}/batteries?district=5&availableOnly=true`).expect(200)).body;
    expect(fit.batteries).toEqual([]);
  });

  it('rejects a battery that does not fit the vehicle', async () => {
    const b = await planBooking(5, 'P206');
    const big = await prisma.battery.findUniqueOrThrow({ where: { sku: 'VAR-70' } });
    const res = await api()
      .post('/api/orders')
      .set('Idempotency-Key', randomUUID())
      .send({ ...orderBody(b), batteryId: big.id })
      .expect(422);
    expect(res.body.code).toBe('INCOMPATIBLE_BATTERY');
  });

  it('gives the last unit to exactly one of two concurrent orders', async () => {
    const b = await planBooking(5, 'P206', 'NIR-66', 2);
    const branch = await prisma.branch.findUniqueOrThrow({ where: { code: 'WEST' } });
    const s = await stockOf(branch.id, b.batteryId);
    await prisma.stock.update({ where: { id: s.id }, data: { onHand: s.reserved + 1 } });

    const results = await Promise.all(
      [0, 1].map(() => api().post('/api/orders').set('Idempotency-Key', randomUUID()).send(orderBody(b))),
    );
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    const after = await stockOf(branch.id, b.batteryId);
    expect(after.onHand - after.reserved).toBe(0);
  });

  it('creates one order for two concurrent requests with the same key', async () => {
    const b = await planBooking(5, 'P206', undefined, 2);
    const key = randomUUID();
    const body = orderBody(b);
    const results = await Promise.all([0, 1].map(() => api().post('/api/orders').set('Idempotency-Key', key).send(body)));
    expect(results.map((r) => r.status).sort()).toEqual([200, 201]);
    expect(results[0]!.body.id).toBe(results[1]!.body.id);
    expect(await prisma.order.count({ where: { idempotencyKey: key } })).toBe(1);
  });

  it('closes a slot when its capacity is used up', async () => {
    const b = await planBooking(5, 'P206', 'SAB-60');
    const avail = (await api().get('/api/lookups/availability?district=5').expect(200)).body;
    const remaining = avail.days
      .find((d: { date: string }) => d.date === b.scheduledDate)
      .slots.find((s: { id: string }) => s.id === b.slotId).remaining;
    for (let i = 0; i < remaining; i++) await place(b);
    const res = await api().post('/api/orders').set('Idempotency-Key', randomUUID()).send(orderBody(b)).expect(409);
    expect(res.body.code).toBe('SLOT_FULL');
  });

  it('refuses a technician who is at capacity', async () => {
    const b = await planBooking(5, 'P206');
    const order = await place(b);
    const options = (await api().get(`/api/orders/${order.id}/technicians`).set(as('operator')).expect(200)).body;
    const t = options[0];
    await prisma.technician.update({ where: { id: t.id }, data: { dailyCapacity: t.load } });
    const ranked = (await api().get(`/api/orders/${order.id}/technicians`).set(as('operator')).expect(200)).body;
    expect(ranked.find((x: { id: string }) => x.id === t.id).fit).toBe('FULL');
    const res = await api().post(`/api/orders/${order.id}/assign`).set(as('operator')).send({ technicianId: t.id }).expect(422);
    expect(res.body.code).toBe('INVALID_TECHNICIAN');
    await prisma.technician.update({ where: { id: t.id }, data: { dailyCapacity: 6 } });
  });

  it('refuses transitions that are not allowed', async () => {
    const b = await planBooking(5, 'P206');
    const order = await place(b);
    const res = await api()
      .post(`/api/missions/${order.id}/finish`)
      .set(as('admin'))
      .send({ installedSerial: 'X-1', coreReturned: false, receivedRial: '1', method: 'CASH' })
      .expect(409);
    expect(res.body.code).toBe('INVALID_TRANSITION');
    expect(res.body.details.allowed).toEqual(['ASSIGNED', 'CANCELLED']);
    await api().post(`/api/missions/${order.id}/accept`).set(as('operator')).expect(403);

    // Cancelling releases the reservation.
    const before = await stockOf(order.branch.id, b.batteryId);
    const cancelled = await api()
      .post(`/api/orders/${order.id}/cancel`)
      .set(as('operator'))
      .send({ reason: 'انصراف مشتری' })
      .expect(200);
    expect(cancelled.body.status).toBe('CANCELLED');
    expect((await stockOf(order.branch.id, b.batteryId)).reserved).toBe(before.reserved - 1);
  });
});

describe('branch scope', () => {
  it('hides other branches from branch roles and other missions from technicians', async () => {
    const east = await prisma.order.findFirstOrThrow({ where: { branch: { code: 'EAST' } } });
    await api().get(`/api/orders/${east.id}`).set(as('operator')).expect(404);
    await api().get(`/api/orders/${east.id}`).set(as('tech')).expect(404);
    await api().get(`/api/orders/${east.id}`).set(as('admin')).expect(200);

    const list = (await api().get('/api/orders?pageSize=100').set(as('operator')).expect(200)).body;
    expect(list.items.every((o: { branch: { code: string } }) => o.branch.code === 'WEST')).toBe(true);
    expect(list.items.every((o: { batteryCostRial?: unknown }) => o.batteryCostRial === undefined)).toBe(true);

    const res = await api().get(`/api/reports/summary?branchId=${east.branchId}`).set(as('manager')).expect(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('keeps technicians out of office screens', async () => {
    const res = await api().get('/api/dashboard').set(as('tech')).expect(403);
    expect(res.body).toMatchObject({ code: 'FORBIDDEN' });
    await api().get('/api/orders').expect(401);
  });
});
