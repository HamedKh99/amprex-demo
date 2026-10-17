import { CORE_CONDITIONS, type CoreCondition } from '@amprex/shared';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { NormalizeText } from '../common/transforms.js';

export const MISSION_VIEWS = ['active', 'today', 'upcoming', 'history'] as const;
export type MissionView = (typeof MISSION_VIEWS)[number];

export class MissionsQuery {
  /** active = not finished (default); today / upcoming = by scheduled day; history = finished. */
  @IsOptional()
  @IsIn(MISSION_VIEWS)
  view: MissionView = 'active';
}

export class InstallDto {
  /** Serial printed on the new battery. */
  @NormalizeText()
  @IsString()
  @MinLength(3)
  @MaxLength(60)
  installedSerial: string;

  /** Old battery (باتری داغی) outcome. */
  @IsIn(CORE_CONDITIONS)
  coreCondition: CoreCondition;

  /** Brand / capacity of the old battery as seen on site. */
  @IsOptional()
  @NormalizeText()
  @IsString()
  @MaxLength(120)
  oldBatteryNote?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  technicianNote?: string;
}
