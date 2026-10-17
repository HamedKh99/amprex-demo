import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('missions')
@Controller('missions')
export class MissionsController {}
