import { Module } from '@nestjs/common';
import { HiresController } from './hires.controller';
import { HIRES_REPOSITORY, InMemoryHiresRepository } from './hires.repository';
import { HiresService } from './hires.service';
import { INVITE_PORT, QueueInvitePort } from './invite.port';

@Module({
  controllers: [HiresController],
  providers: [
    HiresService,
    { provide: HIRES_REPOSITORY, useClass: InMemoryHiresRepository },
    { provide: INVITE_PORT, useClass: QueueInvitePort },
  ],
})
export class HiresModule {}
