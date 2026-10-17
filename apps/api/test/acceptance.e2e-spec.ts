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
  price: { totalRial: string; batteryPriceRial: string; installFeeRial: string; coreCreditRial: string };
  battery: { coreCreditRial: string; sku: string };
}

/** Picks a vehicle/battery/day/slot the way the site would, using only API answers. */
async function planBooking(district: number, vehicleCode: string, sku?: string, minRemaining = 1): Promise<Booking> {
  const vehicles = (await api().get('/api/catalog/vehicles').expect(200)).body;
  const vehicle = vehicles.find((v: { code: string }) => v.code === vehicleCode);
  const fit = (await api().get(`/api/catalog/vehicles/${vehicle.id}/batteries?district=${district}`).expect(200)).body;
  const battery = sku ? fit.batteries.find((b: { sku: string }) => b.sku === sku) : fit.batteries.find((b: { inStock: boolean }) => b.inStock);
  const avail = (await api().get(`/api/lookups/availability?district=${district}`).expect(200)).body;
  for (const day of avail.days) {
    const slot = day.slots.find((s: { remaining: number }) => s.remaining >= minRemaining);
    if (slot) {
      return {
        vehicleModelId: vehicle.id,
        batteryId: battery.id,
        district,
        scheduledDate: day.date,
        slotId: slot.id,
        price: battery.price,
        battery,
      };
    }
  }
  throw new Error('no free slot in the booking window');
}

function orderBody(b: Booking, coreReturnExpected = true) {
  return {
    customerName: 'مشتری آزمون',
    customerPhone: phone(),
    vehicleModelId: b.vehicleModelId,
    batteryId: b.batteryId,
    district: b.district,
    address: `تهران، منطقه ${b.district}، خیابان آزمون، پلاک ۱`,
    scheduledDate: b.scheduledDate,
    slotId: b.slotId,
    coreReturnExpected,
  };
}

async function stockOf(branchId: string, batteryId: string) {
  return prisma.stock.findUniqueOrThrow({ where: { branchId_batteryId: { branchId, batteryId } } });
}

describe('order → install → pay → complete → report', () => {
  it('requires an Idempotency-Key', async () => {
    const b = await planBooking(5, 'P206');
    const res = await api().post('/api/orders').send(orderBody(b)).expect(400);
    expect(res.body.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('runs the full acceptance path', async () => {
    // 1) Customer orders on the site (anonymous) with a compatible, in-stock battery.
    const b = await planBooking(5, 'P206');
    const body = orderBody(b);
    const key = randomUUID();
    const created = await api().post('/api/orders').set('Idempotency-Key', key).send(body).expect(201);
    const order = created.body;
    expect(order.status).toBe('CREATED');
    expect(order.channel.code).toBe('WEBSITE');
    expect(order.totalRial).toBe(b.price.totalRial);

    // Retried checkout returns the same order.
    const again = await api().post('/api/orders').set('Idempotency-Key', key).send(body).expect(200);
    expect(again.body.id).toBe(order.id);

    const afterReserve = await stockOf(order.branch.id, b.batteryId);

    // 2) Operator assigns the demo technician.
    const techs = (await api().get('/api/users/technicians').set(as('operator')).expect(200)).body;
    const tech = techs.find((t: { userId: string | null }) => t.userId);
    const assigned = await api()
      .post(`/api/orders/${order.id}/assign`)
      .set(as('operator'))
      .send({ technicianId: tech.id })
      .expect(200);
    expect(assigned.body.status).toBe('ASSIGNED');

    // 3) Technician sees and runs the mission.
    const missions = (await api().get('/api/missions').set(as('tech')).expect(200)).body;
    const mine = missions.find((m: { id: string }) => m.id === order.id);
    expect(mine.allowedTransitions).toEqual(['EN_ROUTE']);
    await api().post(`/api/missions/${order.id}/depart`).set(as('tech')).expect(200);
    await api().post(`/api/missions/${order.id}/arrive`).set(as('tech')).expect(200);
    const installed = await api()
      .post(`/api/missions/${order.id}/install`)
      .set(as('tech'))
      .send({ installedSerial: 'SN-E2E-0001', coreCondition: 'DAMAGED', oldBatteryNote: 'صبا ۵۵ آمپر' })
      .expect(200);
    expect(installed.body.status).toBe('INSTALLED');
    const halfCredit = BigInt(b.battery.coreCreditRial) / 2n;
    expect(installed.body.coreCreditRial).toBe(halfCredit.toString());
    expect(installed.body.totalRial).toBe(
      (BigInt(b.price.batteryPriceRial) + BigInt(b.price.installFeeRial) - halfCredit).toString(),
    );
    expect(installed.body.coreReturn.condition).toBe('DAMAGED');

    const afterIssue = await stockOf(order.branch.id, b.batteryId);
    expect(afterIssue.onHand).toBe(afterReserve.onHand - 1);
    expect(afterIssue.reserved).toBe(afterReserve.reserved - 1);

    // 4) Payment (amount comes from the server) and completion.
    const paid = await api()
      .post(`/api/orders/${order.id}/payments`)
      .set(as('tech'))
      .send({ method: 'CARD_POS', reference: '123456' })
      .expect(201);
    expect(paid.body.status).toBe('PAID');
    expect(paid.body.payments[0].amountRial).toBe(installed.body.totalRial);

    const done = await api().post(`/api/orders/${order.id}/complete`).set(as('operator')).send({}).expect(200);
    expect(done.body.status).toBe('COMPLETED');
    expect(done.body.events.map((e: { toStatus: string }) => e.toStatus)).toEqual([
      'CREATED', 'ASSIGNED', 'EN_ROUTE', 'ON_SITE', 'INSTALLED', 'PAID', 'COMPLETED',
    ]);

    // 5) Customer tracking page and admin report.
    const tracked = await api()
      .get(`/api/orders/track?number=${order.number}&phone=${body.customerPhone}`)
      .expect(200);
    expect(tracked.body.status).toBe('COMPLETED');

    const report = (await api().get('/api/reports/summary').set(as('manager')).expect(200)).body;
    expect(report.range.branchId).toBe(order.branch.id);
    expect(report.kpis.completed).toBeGreaterThan(0);
    expect(report.byChannel.some((c: { code: string }) => c.code === 'WEBSITE')).toBe(true);
    expect(report.daily.length).toBe(30);
  });
});

describe('business rules', () => {
  it('rejects an out-of-stock battery with 409 OUT_OF_STOCK', async () => {
    // Seed: EAST branch has no ATL-74; district 4 is served by EAST.
    const b = await planBooking(4, 'CERATO', 'ATL-74');
    expect(b.battery).toMatchObject({ inStock: false });
    const res = await api().post('/api/orders').set('Idempotency-Key', randomUUID()).send(orderBody(b)).expect(409);
    expect(res.body.code).toBe('OUT_OF_STOCK');
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
    const results = await Promise.all(
      [0, 1].map(() => api().post('/api/orders').set('Idempotency-Key', key).send(body)),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 201]);
    expect(results[0]!.body.id).toBe(results[1]!.body.id);
    expect(await prisma.order.count({ where: { idempotencyKey: key } })).toBe(1);
  });

  it('closes a slot when its capacity is used up', async () => {
    const b = await planBooking(5, 'P206');
    const avail = (await api().get('/api/lookups/availability?district=5').expect(200)).body;
    const remaining = avail.days
      .find((d: { date: string }) => d.date === b.scheduledDate)
      .slots.find((s: { id: string }) => s.id === b.slotId).remaining;
    for (let i = 0; i < remaining; i++) {
      await api().post('/api/orders').set('Idempotency-Key', randomUUID()).send(orderBody(b)).expect(201);
    }
    const res = await api().post('/api/orders').set('Idempotency-Key', randomUUID()).send(orderBody(b)).expect(409);
    expect(res.body.code).toBe('SLOT_FULL');
  });

  it('refuses transitions that are not allowed', async () => {
    const b = await planBooking(5, 'P206');
    const order = (
      await api().post('/api/orders').set('Idempotency-Key', randomUUID()).send(orderBody(b)).expect(201)
    ).body;
    const res = await api().post(`/api/orders/${order.id}/complete`).set(as('operator')).send({}).expect(409);
    expect(res.body.code).toBe('INVALID_TRANSITION');
    expect(res.body.details.allowed).toEqual(['ASSIGNED', 'CANCELLED']);

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

    const res = await api().get(`/api/reports/summary?branchId=${east.branchId}`).set(as('manager')).expect(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('keeps technicians out of office actions', async () => {
    const res = await api().get('/api/reports/summary').set(as('tech')).expect(403);
    expect(res.body).toMatchObject({ code: 'FORBIDDEN' });
    await api().get('/api/orders').expect(401);
  });
});
