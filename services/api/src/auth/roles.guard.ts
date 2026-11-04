import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '../accounts/accounts.constants';
import type { AuthRequest } from './auth.guard';
import { ROLES_KEY } from './roles.decorator';

/** The one place that decides role: runs after AuthGuard, refuses with 403 unless `req.user.role` is listed. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowed = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const req = context.switchToHttp().getRequest<AuthRequest>();
    // Fail closed: no role list, or no user, is a refusal.
    if (!allowed || !req.user || !allowed.includes(req.user.role)) {
      throw new ForbiddenException('Your role cannot do this.');
    }
    return true;
  }
}
