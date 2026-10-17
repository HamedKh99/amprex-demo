import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../common/app-exception.js';
import type { Prisma } from '../generated/prisma/client.js';
import { documentCode } from '../orders/order-code.js';
import { PrismaService } from '../prisma/prisma.service.js';

type Tx = Prisma.TransactionClient;

interface StockRef {
  branchId: string;
  batteryId: string;
  orderId: string;
  actorUserId: string | null;
}

/**
 * All stock mutations. Each is one conditional UPDATE that must run inside the caller's
 * transaction; 0 affected rows means the guard failed and the transaction is aborted.
 */
@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  /** Hold one unit for an order (order creation). */
  async reserve(tx: Tx, ref: StockRef) {
    const rows = await tx.$executeRaw`
      UPDATE "Stock" SET "reserved" = "reserved" + 1, "updatedAt" = now()
      WHERE "branchId" = ${ref.branchId}::uuid AND "batteryId" = ${ref.batteryId}::uuid
        AND "onHand" - "reserved" >= 1`;
    if (rows === 0) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'OUT_OF_STOCK',
        'این باتری در حال حاضر در شعبه منطقه شما موجود نیست.',
        { branchId: ref.branchId, batteryId: ref.batteryId },
      );
    }
    await this.log(tx, ref, 'RESERVE', 1);
  }

  /** Give back a held unit (cancellation before installation). */
  async release(tx: Tx, ref: StockRef) {
    const rows = await tx.$executeRaw`
      UPDATE "Stock" SET "reserved" = "reserved" - 1, "updatedAt" = now()
      WHERE "branchId" = ${ref.branchId}::uuid AND "batteryId" = ${ref.batteryId}::uuid
        AND "reserved" >= 1`;
    if (rows === 0) throw this.inconsistent(ref);
    await this.log(tx, ref, 'RELEASE', -1);
  }

  /** The held unit leaves the shelf (installation). */
  async issue(tx: Tx, ref: StockRef) {
    const rows = await tx.$executeRaw`
      UPDATE "Stock" SET "onHand" = "onHand" - 1, "reserved" = "reserved" - 1, "updatedAt" = now()
      WHERE "branchId" = ${ref.branchId}::uuid AND "batteryId" = ${ref.batteryId}::uuid
        AND "reserved" >= 1 AND "onHand" >= 1`;
    if (rows === 0) throw this.inconsistent(ref);
    await this.log(tx, ref, 'ISSUE', -1);
  }

  /** «ثبت ورود کالا»: goods received into a branch, under a new RCV- document number. */
  async receive(params: { branchId: string; batteryId: string; quantity: number; actorUserId: string; note?: string }) {
    const { branchId, batteryId, quantity, actorUserId, note } = params;
    const reference = documentCode('RCV', new Date());
    return this.prisma.$transaction(async (tx) => {
      const stock = await tx.stock.upsert({
        where: { branchId_batteryId: { branchId, batteryId } },
        create: { branchId, batteryId, onHand: quantity },
        update: { onHand: { increment: quantity } },
      });
      await tx.stockMovement.create({
        data: { branchId, batteryId, type: 'RECEIPT', quantity, actorUserId, reference, note },
      });
      return { stock, reference };
    });
  }

  /**
   * «انتقال بین انبارها»: moves free units between branches under one TRF- number.
   * The source guard (free units ≥ quantity) is a single conditional UPDATE.
   */
  async transfer(params: {
    fromBranchId: string;
    toBranchId: string;
    batteryId: string;
    quantity: number;
    actorUserId: string;
    note?: string;
  }) {
    const { fromBranchId, toBranchId, batteryId, quantity, actorUserId, note } = params;
    const reference = documentCode('TRF', new Date());
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$executeRaw`
        UPDATE "Stock" SET "onHand" = "onHand" - ${quantity}, "updatedAt" = now()
        WHERE "branchId" = ${fromBranchId}::uuid AND "batteryId" = ${batteryId}::uuid
          AND "onHand" - "reserved" >= ${quantity}`;
      if (rows === 0) {
        throw new AppException(HttpStatus.CONFLICT, 'OUT_OF_STOCK', 'موجودی قابل فروش برای این انتقال کافی نیست.', {
          branchId: fromBranchId,
          batteryId,
          quantity,
        });
      }
      await tx.stock.upsert({
        where: { branchId_batteryId: { branchId: toBranchId, batteryId } },
        create: { branchId: toBranchId, batteryId, onHand: quantity },
        update: { onHand: { increment: quantity } },
      });
      await tx.stockMovement.createMany({
        data: [
          { branchId: fromBranchId, batteryId, type: 'TRANSFER', quantity: -quantity, actorUserId, reference, note },
          { branchId: toBranchId, batteryId, type: 'TRANSFER', quantity, actorUserId, reference, note },
        ],
      });
      return { reference };
    });
  }

  private log(tx: Tx, ref: StockRef, type: 'RESERVE' | 'RELEASE' | 'ISSUE', quantity: number) {
    return tx.stockMovement.create({
      data: {
        branchId: ref.branchId,
        batteryId: ref.batteryId,
        orderId: ref.orderId,
        actorUserId: ref.actorUserId,
        type,
        quantity,
      },
    });
  }

  private inconsistent(ref: StockRef) {
    // A held unit should always exist here; this signals data drift, not user error.
    return new AppException(
      HttpStatus.CONFLICT,
      'OUT_OF_STOCK',
      'موجودی رزروشده برای این سفارش در انبار یافت نشد.',
      { branchId: ref.branchId, batteryId: ref.batteryId, orderId: ref.orderId },
    );
  }
}
