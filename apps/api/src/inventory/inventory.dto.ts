import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class StockQuery {
  /** SUPER_ADMIN only; other roles always see their own branch. */
  @IsOptional()
  @IsUUID()
  branchId?: string;
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
