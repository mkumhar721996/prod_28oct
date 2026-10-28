import { Body, Controller, Get, Post } from '@nestjs/common';
import { HiresService } from './hires.service';
import { Hire } from './hires.repository';

@Controller('hires')
export class HiresController {
  constructor(private readonly hires: HiresService) {}

  @Get()
  findAll(): Hire[] {
    return this.hires.findAll();
  }

  @Post()
  create(@Body() body: unknown): Promise<Hire> {
    return this.hires.create(body);
  }
}
