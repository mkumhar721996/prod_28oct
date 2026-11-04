import { Injectable } from '@nestjs/common';
import type { Response } from 'express';
import { randomBytes } from 'node:crypto';
import type { AppUser } from '../accounts/accounts.service';
import { DatabaseService } from '../database/database.service';
import { hashToken, readCookie, sessionCookieOptions } from '../session/session.service';
import { ORG_IDLE_MS, ORG_SESSION_COOKIE } from './auth.constants';

export type AuthResolution =
  | { ok: true; user: AppUser }
  | { ok: false; reason: 'signed-out' | 'expired' };

@Injectable()
export class AuthSessionService {
  constructor(private readonly db: DatabaseService) {}

  /** Issues a random token, stores only its hash, and sets a session-lifetime cookie. */
  async start(res: Response, userId: string): Promise<void> {
    const token = randomBytes(32).toString('base64url');
    await this.db.pool.query('insert into app_sessions (token_hash, user_id) values ($1, $2)', [
      hashToken(token),
      userId,
    ]);
    res.cookie(ORG_SESSION_COOKIE, token, sessionCookieOptions());
  }

  /**
   * One atomic statement slides the idle window and matches only a row still inside it, so the
   * limit is enforced on every request. Every path other than a matched row refuses.
   */
  async resolve(cookieHeader: string | undefined): Promise<AuthResolution> {
    const token = readCookie(cookieHeader, ORG_SESSION_COOKIE);
    if (!token) return { ok: false, reason: 'signed-out' };
    const tokenHash = hashToken(token);
    const { rows } = await this.db.pool.query(
      `update app_sessions s set last_activity_at = now() from app_users u
       where s.token_hash = $1 and s.last_activity_at > $2 and u.id = s.user_id
       returning u.id, u.email, u.role`,
      [tokenHash, new Date(Date.now() - ORG_IDLE_MS)],
    );
    if (rows[0]) return { ok: true, user: rows[0] as AppUser };
    const known = await this.db.pool.query('select 1 from app_sessions where token_hash = $1', [
      tokenHash,
    ]);
    return { ok: false, reason: known.rows.length > 0 ? 'expired' : 'signed-out' };
  }

  async end(cookieHeader: string | undefined, res: Response): Promise<void> {
    const token = readCookie(cookieHeader, ORG_SESSION_COOKIE);
    if (token) {
      await this.db.pool.query('delete from app_sessions where token_hash = $1', [
        hashToken(token),
      ]);
    }
    res.clearCookie(ORG_SESSION_COOKIE, sessionCookieOptions());
  }
}
