import { Injectable } from '@nestjs/common';
import type { Response } from 'express';
import { randomBytes } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { hashToken, readCookie, sessionCookieOptions } from '../session/session.service';
import { STAFF_IDLE_MS, STAFF_SESSION_COOKIE } from './staff.constants';
import type { StaffMember } from './staff.service';

export type StaffResolution =
  | { ok: true; staff: StaffMember }
  | { ok: false; reason: 'signed-out' | 'expired' };

@Injectable()
export class StaffSessionService {
  constructor(private readonly db: DatabaseService) {}

  /** Issues a random token, stores only its hash, and sets a session-lifetime cookie. */
  async start(res: Response, staffId: string): Promise<void> {
    const token = randomBytes(32).toString('base64url');
    await this.db.pool.query('insert into staff_sessions (token_hash, staff_id) values ($1, $2)', [
      hashToken(token),
      staffId,
    ]);
    res.cookie(STAFF_SESSION_COOKIE, token, sessionCookieOptions());
  }

  /**
   * One atomic statement slides the idle window and matches only a row still inside it, so the
   * 15-minute limit is enforced here on every request. The comparison is strict: exactly 15
   * minutes idle is refused. Every path other than a matched row refuses.
   */
  async resolve(cookieHeader: string | undefined): Promise<StaffResolution> {
    const token = readCookie(cookieHeader, STAFF_SESSION_COOKIE);
    if (!token) return { ok: false, reason: 'signed-out' };
    const tokenHash = hashToken(token);
    const { rows } = await this.db.pool.query(
      `update staff_sessions s set last_activity_at = now() from staff_accounts a
       where s.token_hash = $1 and s.last_activity_at > $2 and a.id = s.staff_id
       returning a.id, a.email`,
      [tokenHash, new Date(Date.now() - STAFF_IDLE_MS)],
    );
    if (rows[0]) return { ok: true, staff: rows[0] as StaffMember };
    const known = await this.db.pool.query('select 1 from staff_sessions where token_hash = $1', [
      tokenHash,
    ]);
    return { ok: false, reason: known.rows.length > 0 ? 'expired' : 'signed-out' };
  }

  async end(cookieHeader: string | undefined, res: Response): Promise<void> {
    const token = readCookie(cookieHeader, STAFF_SESSION_COOKIE);
    if (token) {
      await this.db.pool.query('delete from staff_sessions where token_hash = $1', [
        hashToken(token),
      ]);
    }
    res.clearCookie(STAFF_SESSION_COOKIE, sessionCookieOptions());
  }
}
