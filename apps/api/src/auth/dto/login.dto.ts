import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { IRAN_MOBILE, NormalizeText } from '../../common/transforms.js';

export class LoginDto {
  /** Mobile number, e.g. 09120000001 (Persian digits accepted). */
  @NormalizeText()
  @Matches(IRAN_MOBILE, { message: 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.' })
  phone: string;

  @IsString()
  @MinLength(4)
  @MaxLength(128)
  password: string;
}
