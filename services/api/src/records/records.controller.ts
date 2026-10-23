import { Controller, Get } from '@nestjs/common';

@Controller('records')
export class RecordsController {
  @Get()
  findAll(): unknown[] {
    return [];
  }
}
