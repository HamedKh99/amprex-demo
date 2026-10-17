import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('inventory')
@Controller('inventory')
export class InventoryController {}
