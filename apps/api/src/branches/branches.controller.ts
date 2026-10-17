import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('branches')
@Controller('branches')
export class BranchesController {}
