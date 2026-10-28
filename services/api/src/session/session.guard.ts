import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { Player } from '../players/players.service';
import { SessionService } from './session.service';

export type PlayerRequest = Request & { player: Player };

/** Resolves the session cookie to `req.player`; 401 when signed out. */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<PlayerRequest>();
    const player = await this.sessions.resolve(req.headers.cookie);
    if (!player) throw new UnauthorizedException();
    req.player = player;
    return true;
  }
}
