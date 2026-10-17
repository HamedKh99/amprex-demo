import { STOCK_MOVEMENT_TYPES } from '@amprex/shared';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { DATE_ONLY } from '../common/transforms.js';
import type { LedgerType } from './inventory.service.js';

export class BranchQuery {
  /** Required for SUPER_ADMIN; other roles always get their own branch. */
  @IsOptional()
  @IsUUID()
  branchId?: string;
}

export class LedgerQuery extends BranchQuery {
  /** Tehran day "YYYY-MM-DD"; defaults to today. */
  @IsOptional()
  @Matches(DATE_ONLY)
  from?: string;

  @IsOptional()
  @Matches(DATE_ONLY)
  to?: string;

  @IsOptional()
  @IsIn([...STOCK_MOVEMENT_TYPES, 'CORE_RETURN'])
  type?: LedgerType;
}

export class ReceiptDto {
  @IsUUID()
  branchId: string;

  @IsUUID()
  batteryId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class TransferDto {
  @IsUUID()
  fromBranchId: string;

  @IsUUID()
  toBranchId: string;

  @IsUUID()
  batteryId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
