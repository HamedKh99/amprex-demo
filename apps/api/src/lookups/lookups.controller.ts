import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('lookups')
@Controller('lookups')
export class LookupsController {}
