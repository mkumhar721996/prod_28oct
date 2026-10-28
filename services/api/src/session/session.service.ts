import { Injectable } from '@nestjs/common';
import type { CookieOptions, Response } from 'express';
import { createHash, randomBytes } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import type { Player } from '../players/players.service';

export const SESSION_COOKIE = 'session';
const SESSION_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Cookie parsing by hand: one cookie, no cookie-parser dependency. */
export function readCookie(header: string | undefined, name: string): string | undefined {
  for (const part of (header ?? '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return value.join('=');
  }
  return undefined;
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

@Injectable()
export class SessionService {
  constructor(private readonly db: DatabaseService) {}

  private cookieOptions(): CookieOptions {
    const secure = process.env.SESSION_COOKIE_SECURE
      ? process.env.SESSION_COOKIE_SECURE === 'true'
      : process.env.NODE_ENV === 'production';
    return { httpOnly: true, sameSite: 'lax', secure, path: '/' };
  }

  /** Issues a random token, stores only its hash, and sets the cookie. */
  async start(res: Response, playerId: string): Promise<void> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_DAYS * DAY_MS);
    await this.db.pool.query(
      'insert into sessions (token_hash, player_id, expires_at) values ($1, $2, $3)',
      [hashToken(token), playerId, expiresAt],
    );
    res.cookie(SESSION_COOKIE, token, { ...this.cookieOptions(), expires: expiresAt });
  }

  async resolve(cookieHeader: string | undefined): Promise<Player | null> {
    const token = readCookie(cookieHeader, SESSION_COOKIE);
    if (!token) return null;
    const { rows } = await this.db.pool.query(
      `select p.id, p.email from sessions s join players p on p.id = s.player_id
       where s.token_hash = $1 and s.expires_at > now()`,
      [hashToken(token)],
    );
    return (rows[0] as Player | undefined) ?? null;
  }

  async end(cookieHeader: string | undefined, res: Response): Promise<void> {
    const token = readCookie(cookieHeader, SESSION_COOKIE);
    if (token) {
      await this.db.pool.query('delete from sessions where token_hash = $1', [hashToken(token)]);
    }
    res.clearCookie(SESSION_COOKIE, this.cookieOptions());
  }
}
