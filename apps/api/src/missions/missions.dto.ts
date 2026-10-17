import { ON_SITE_PAYMENT_METHODS, type PaymentMethod } from '@amprex/shared';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { NormalizeText, ToBoolean } from '../common/transforms.js';
import { BUSINESS_RULES } from '../config/business-rules.js';

export const MISSION_VIEWS = ['active', 'today', 'upcoming', 'history'] as const;
export type MissionView = (typeof MISSION_VIEWS)[number];

const AH_MESSAGE = `عدد بین ${BUSINESS_RULES.coreAhMin} تا ${BUSINESS_RULES.coreAhMax} وارد کنید.`;

export class MissionsQuery {
  /** today (default) = everything scheduled today incl. finished; active = not finished. */
  @IsOptional()
  @IsIn(MISSION_VIEWS)
  view: MissionView = 'today';
}

export class SettlementQuery {
  /** «باتری کهنه تحویل گرفته شد؟» */
  @ToBoolean()
  @IsBoolean()
  coreReturned: boolean;

  /** «آمپر باتری کهنه (از روی برچسب)» */
  @ValidateIf((o: SettlementQuery) => o.coreReturned)
  @Type(() => Number)
  @IsInt({ message: AH_MESSAGE })
  @Min(BUSINESS_RULES.coreAhMin, { message: AH_MESSAGE })
  @Max(BUSINESS_RULES.coreAhMax, { message: AH_MESSAGE })
  oldBatteryAh?: number;
}

export class FinishDto {
  /** «شماره سریال» of the installed battery. */
  @NormalizeText()
  @IsString()
  @MinLength(3)
  @MaxLength(60)
  installedSerial: string;

  @IsBoolean()
  coreReturned: boolean;

  @ValidateIf((o: FinishDto) => o.coreReturned)
  @IsInt({ message: AH_MESSAGE })
  @Min(BUSINESS_RULES.coreAhMin, { message: AH_MESSAGE })
  @Max(BUSINESS_RULES.coreAhMax, { message: AH_MESSAGE })
  oldBatteryAh?: number;

  /** «مبلغ دریافتی», Rial as a decimal string. May differ from the payable (recorded as a mismatch). */
  @Matches(/^\d{1,15}$/)
  @Transform(({ value }) => (typeof value === 'number' ? String(value) : value))
  receivedRial: string;

  @IsIn(ON_SITE_PAYMENT_METHODS)
  method: PaymentMethod;

  /** «کد پیگیری انتقال» (card-to-card) or POS reference. */
  @IsOptional()
  @NormalizeText()
  @IsString()
  @MaxLength(60)
  reference?: string;

  /** «یادداشت» */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  technicianNote?: string;
}
