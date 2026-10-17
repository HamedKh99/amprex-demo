import { INSTALL_LOCATIONS, ORDER_STATUSES, type InstallLocation, type OrderStatus } from '@amprex/shared';
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

  /** «محل نصب» */
  @IsIn(INSTALL_LOCATIONS)
  installLocation: InstallLocation;

  /** Installation day, Gregorian "YYYY-MM-DD" (Tehran calendar day). */
  @NormalizeText()
  @Matches(DATE_ONLY)
  scheduledDate: string;

  @IsUUID()
  slotId: string;

  /** The customer has an old battery to hand over (default true); drives the estimate. */
  @IsOptional()
  @IsBoolean()
  hasOldBattery: boolean = true;

  /** «توضیح برای تکنسین» */
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

  @IsOptional()
  @IsString()
  @MaxLength(30)
  channelCode?: string;

  /** Order code, customer phone or name fragment. */
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
  /** «کد پیگیری», e.g. AMX-050725-K7Q2 */
  @NormalizeText()
  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : value))
  @IsString()
  @MaxLength(30)
  code: string;

  @NormalizeText()
  @Matches(IRAN_MOBILE, { message: 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.' })
  phone: string;
}

export class AssignDto {
  @IsUUID()
  technicianId: string;

  /** «یادداشت برای تکنسین»; stored as the order's branch note. */
  @IsOptional()
  @NormalizeText()
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
