import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { AppUser } from '../accounts/accounts.service';
import { AuthSessionService } from './auth-session.service';

export type AuthRequest = Request & { user: AppUser };

/** The one place that decides "signed in or refused": resolves the cookie to `req.user`, else 401 with a reason. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly sessions: AuthSessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const result = await this.sessions.resolve(req.headers.cookie);
    if (!result.ok) throw new UnauthorizedException({ reason: result.reason });
    req.user = result.user;
    return true;
  }
}
