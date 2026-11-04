import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { StaffMember } from './staff.service';
import { StaffSessionService } from './staff-session.service';

export type StaffRequest = Request & { staff: StaffMember };

/** The one place that decides "staff or refused": resolves the staff cookie to `req.staff`, else 401 with a reason. */
@Injectable()
export class StaffGuard implements CanActivate {
  constructor(private readonly sessions: StaffSessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<StaffRequest>();
    const result = await this.sessions.resolve(req.headers.cookie);
    if (!result.ok) throw new UnauthorizedException({ reason: result.reason });
    req.staff = result.staff;
    return true;
  }
}
