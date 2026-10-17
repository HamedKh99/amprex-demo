import { HttpStatus, Injectable } from '@nestjs/common';
import { BranchesService } from '../branches/branches.service.js';
import { AppException, notFound } from '../common/app-exception.js';
import { bookingWindow, dateOnly, formatDateOnly, tehranDate, tehranTime } from '../common/tehran-time.js';
import { BUSINESS_RULES } from '../config/business-rules.js';
import type { Prisma, ServiceSlot } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

type Tx = Prisma.TransactionClient;

/** OPEN: bookable; CLOSED: today's slot is too close or past; FULL: no capacity left. */
export type SlotState = 'OPEN' | 'CLOSED' | 'FULL';

/** Installation slots: booking window and per-branch capacity. */
@Injectable()
export class SchedulingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branches: BranchesService,
  ) {}

  /** A slot on a day can still be booked if it starts at least the lead time from now. */
  isOpen(date: string, slot: Pick<ServiceSlot, 'startTime'>, now = Date.now()) {
    if (date !== tehranDate(now)) return true;
    return tehranTime(date, slot.startTime).getTime() - now >= BUSINESS_RULES.sameDayLeadMinutes * 60_000;
  }

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
    const today = tehranDate();

    return {
      branch: { id: branch.id, name: branch.name },
      days: days.map((date) => {
        const daySlots = slots.map((s) => {
          const remaining = Math.max(0, s.capacity - (used.get(`${date}|${s.id}`) ?? 0));
          const state: SlotState = !this.isOpen(date, s) ? 'CLOSED' : remaining === 0 ? 'FULL' : 'OPEN';
          return {
            id: s.id,
            code: s.code,
            label: s.label,
            startTime: s.startTime,
            endTime: s.endTime,
            capacity: s.capacity,
            remaining: state === 'CLOSED' ? 0 : remaining,
            state,
          };
        });
        return { date, isToday: date === today, isFull: daySlots.every((s) => s.state !== 'OPEN'), slots: daySlots };
      }),
    };
  }

  assertBookableDate(date: string) {
    const window = bookingWindow();
    if (!window.includes(date)) {
      throw new AppException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'INVALID_BOOKING_DATE',
        'تاریخ نصب باید از امروز تا هفت روز آینده باشد.',
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
    if (!this.isOpen(date, slot)) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'SLOT_FULL',
        'این بازه زمانی دیگر قابل رزرو نیست. لطفاً زمان دیگری انتخاب کنید.',
        { date, slotId, reason: 'CLOSED' },
      );
    }

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
        { date, slotId, reason: 'FULL' },
      );
    }
    return slot;
  }
}
