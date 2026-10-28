import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { EMAIL_PATTERN, MIN_PASSWORD_LENGTH, STARTING_GRANT } from './players.constants';
import { PasswordService } from './password.service';

export type Player = { id: string; email: string };

const UNIQUE_VIOLATION = '23505';

export const normaliseEmail = (email: unknown): string =>
  typeof email === 'string' ? email.trim().toLowerCase() : '';

@Injectable()
export class PlayersService {
  // Hash of a throwaway password, compared against when the email is unknown so both failures cost the same.
  private dummyHash?: Promise<string>;

  constructor(
    private readonly db: DatabaseService,
    private readonly passwords: PasswordService,
  ) {}

  /** Creates the player and the wallet with its one-time grant in ONE transaction. */
  async register(email: unknown, password: unknown): Promise<Player> {
    const normalised = normaliseEmail(email);
    if (!EMAIL_PATTERN.test(normalised)) {
      throw new BadRequestException('Enter an email like name@example.com');
    }
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(`Use at least ${MIN_PASSWORD_LENGTH} characters`);
    }
    const passwordHash = await this.passwords.hash(password);
    const client = await this.db.pool.connect();
    try {
      await client.query('begin');
      const { rows } = await client.query(
        'insert into players (email, password_hash) values ($1, $2) returning id, email',
        [normalised, passwordHash],
      );
      const player = rows[0] as Player;
      await client.query('insert into wallets (player_id, balance_credits) values ($1, $2)', [
        player.id,
        STARTING_GRANT,
      ]);
      await client.query('commit');
      return player;
    } catch (err) {
      await client.query('rollback');
      if ((err as { code?: string }).code === UNIQUE_VIOLATION) {
        throw new ConflictException(
          'An account with this email already exists. Sign in instead, or use a different email.',
        );
      }
      throw err;
    } finally {
      client.release();
    }
  }

  /** The player for these credentials, or null. Never touches the wallet. */
  async authenticate(email: unknown, password: unknown): Promise<Player | null> {
    const candidate = typeof password === 'string' ? password : '';
    const { rows } = await this.db.pool.query(
      'select id, email, password_hash from players where email = $1',
      [normaliseEmail(email)],
    );
    const row = rows[0] as (Player & { password_hash: string }) | undefined;
    if (!row) {
      this.dummyHash ??= this.passwords.hash('unused-dummy-password');
      await this.passwords.verify(await this.dummyHash, candidate);
      return null;
    }
    return (await this.passwords.verify(row.password_hash, candidate))
      ? { id: row.id, email: row.email }
      : null;
  }
}
