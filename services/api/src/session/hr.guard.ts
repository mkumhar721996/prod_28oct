import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { PlayerRequest } from './session.guard';

/** Runs after SessionGuard: only HR accounts pass, everyone else gets 403. */
@Injectable()
export class HrGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<PlayerRequest>();
    if (req.player?.accountRole !== 'hr') throw new ForbiddenException('Only HR can change templates.');
    return true;
  }
}
