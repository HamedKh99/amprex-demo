import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ToBoolean } from '../common/transforms.js';

export class CompatibleBatteriesQuery {
  /** Tehran district (1–22). When given, `inStock` is reported for the branch serving it. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(22)
  district?: number;

  /** Customer will hand over the old battery (باتری داغی); affects the quoted price. */
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  coreReturn: boolean = true;
}
