import { VEHICLE_TYPES, type VehicleType } from '@amprex/shared';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { NormalizeText, ToBoolean } from '../common/transforms.js';

export class VehiclesQuery {
  @IsOptional()
  @IsIn(VEHICLE_TYPES)
  type?: VehicleType;

  /** Persian brand, e.g. «ایران‌خودرو». */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  brand?: string;

  /** Model search, e.g. «۲۰۶» (Persian digits accepted). */
  @IsOptional()
  @NormalizeText()
  @IsString()
  @MaxLength(40)
  q?: string;
}

export class CompatibleBatteriesQuery {
  /** Tehran district (1–22). When given, `inStock` is reported for the branch serving it. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(22)
  district?: number;

  /** Only batteries with a free unit at the serving branch (requires district). */
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  availableOnly: boolean = false;
}
