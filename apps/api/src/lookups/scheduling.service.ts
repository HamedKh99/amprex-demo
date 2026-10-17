import { HttpStatus, Injectable } from '@nestjs/common';
import { BranchesService } from '../branches/branches.service.js';
import { AppException, notFound } from '../common/app-exception.js';
import { bookingWindow, dateOnly, formatDateOnly } from '../common/tehran-time.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

type Tx = Prisma.TransactionClient;

/** Installation slots: booking window and per-branch capacity. */
@Injectable()
export class SchedulingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branches: BranchesService,
  ) {}

  /** Every bookable day × slot for the branch serving a district, with remaining capacity. */
  async availability(district: number) {
    const branch = await this.branches.forDistrict(district);
    const days = bookingWindow();
    const [slots, booked] = await Promise.all([
      this.prisma.serviceSlot.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
      this.prisma.order.groupBy({
        by: ['scheduledDate', 'slotId'],
        where: {
          branchId: branch.id,
          status: { not: 'CANCELLED' },
          scheduledDate: { gte: dateOnly(days[0]!), lte: dateOnly(days.at(-1)!) },
        },
        _count: true,
      }),
    ]);
    const used = new Map(booked.map((b) => [`${formatDateOnly(b.scheduledDate)}|${b.slotId}`, b._count]));

    return {
      branch: { id: branch.id, name: branch.name },
      days: days.map((date) => ({
        date,
        slots: slots.map((s) => {
          const taken = used.get(`${date}|${s.id}`) ?? 0;
          return {
            id: s.id,
            code: s.code,
            label: s.label,
            startTime: s.startTime,
            endTime: s.endTime,
            capacity: s.capacity,
            remaining: Math.max(0, s.capacity - taken),
          };
        }),
      })),
    };
  }

  assertBookableDate(date: string) {
    const window = bookingWindow();
    if (!window.includes(date)) {
      throw new AppException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'INVALID_BOOKING_DATE',
        'تاریخ نصب باید از فردا تا یک هفته آینده باشد.',
        { date, allowed: window },
      );
    }
  }

  /**
   * Claims one place in a slot. Serialised per branch/date/slot with a transaction-scoped
   * advisory lock, so two concurrent orders cannot both take the last place.
   */
  async claimSlot(tx: Tx, branchId: string, date: string, slotId: string) {
    const slot = await tx.serviceSlot.findFirst({ where: { id: slotId, isActive: true } });
    if (!slot) throw notFound('بازه زمانی');

    const lockKey = `slot:${branchId}:${date}:${slotId}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
    const taken = await tx.order.count({
      where: { branchId, slotId, scheduledDate: dateOnly(date), status: { not: 'CANCELLED' } },
    });
    if (taken >= slot.capacity) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'SLOT_FULL',
        'ظرفیت این بازه زمانی تکمیل شده است. لطفاً زمان دیگری انتخاب کنید.',
        { date, slotId },
      );
    }
    return slot;
  }
}
