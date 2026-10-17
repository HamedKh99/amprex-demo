import type { Prisma } from '../generated/prisma/client.js';

const userBrief = { select: { id: true, fullName: true, role: true } } as const;

export const orderListInclude = {
  customer: { select: { id: true, fullName: true, phone: true } },
  branch: { select: { id: true, code: true, name: true } },
  channel: { select: { id: true, code: true, nameFa: true } },
  vehicleModel: { select: { id: true, nameFa: true } },
  battery: { select: { id: true, sku: true, nameFa: true } },
  slot: { select: { id: true, code: true, label: true, startTime: true, endTime: true } },
  mission: {
    select: { technician: { select: { id: true, fullName: true } } },
  },
} satisfies Prisma.OrderInclude;

export const orderDetailInclude = {
  customer: true,
  branch: { select: { id: true, code: true, name: true, phone: true } },
  channel: true,
  vehicleModel: true,
  battery: true,
  slot: true,
  mission: { include: { technician: { select: { id: true, fullName: true, phone: true } } } },
  coreReturn: true,
  payments: { orderBy: { createdAt: 'asc' }, include: { receivedBy: userBrief } },
  events: { orderBy: { createdAt: 'asc' }, include: { actor: userBrief } },
} satisfies Prisma.OrderInclude;
