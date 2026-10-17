import { ORDER_STATUSES, type OrderStatus } from '@amprex/shared';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PageQuery } from '../common/pagination.js';
import { DATE_ONLY, IRAN_MOBILE, NormalizeText } from '../common/transforms.js';

export class CreateOrderDto {
  @NormalizeText()
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  customerName: string;

  @NormalizeText()
  @Matches(IRAN_MOBILE, { message: 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.' })
  customerPhone: string;

  @IsUUID()
  vehicleModelId: string;

  @IsUUID()
  batteryId: string;

  /** Tehran municipal district, 1–22. Decides the serving branch. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(22)
  district: number;

  @NormalizeText()
  @IsString()
  @MinLength(10)
  @MaxLength(300)
  address: string;

  /** Installation day, Gregorian "YYYY-MM-DD" (Tehran calendar day). */
  @NormalizeText()
  @Matches(DATE_ONLY)
  scheduledDate: string;

  @IsUUID()
  slotId: string;

  /** Customer will hand over the old battery (باتری داغی). */
  @IsBoolean()
  coreReturnExpected: boolean;

  @IsOptional()
  @NormalizeText()
  @IsString()
  @MaxLength(500)
  customerNote?: string;

  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;

  /** Staff only (e.g. PHONE). Ignored for anonymous orders, which are always WEBSITE. */
  @IsOptional()
  @IsString()
  @MaxLength(30)
  channelCode?: string;
}

export class ListOrdersQuery extends PageQuery {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',') : value))
  @IsIn(ORDER_STATUSES, { each: true })
  status?: OrderStatus[];

  /** SUPER_ADMIN only; other roles are limited to their own branch. */
  @IsOptional()
  @IsUUID()
  branchId?: string;

  /** Order number or customer phone/name fragment. */
  @IsOptional()
  @NormalizeText()
  @IsString()
  @MaxLength(50)
  q?: string;

  /** Scheduled date range, "YYYY-MM-DD". */
  @IsOptional()
  @Matches(DATE_ONLY)
  from?: string;

  @IsOptional()
  @Matches(DATE_ONLY)
  to?: string;
}

export class TrackOrderQuery {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  number: number;

  @NormalizeText()
  @Matches(IRAN_MOBILE)
  phone: string;
}

export class AssignDto {
  @IsUUID()
  technicianId: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class CancelDto {
  @NormalizeText()
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  reason: string;
}

export class NoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
