import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { PasswordService } from '../players/password.service';
import {
  EMAIL_PATTERN,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from '../players/players.constants';
import { normaliseEmail } from '../players/players.service';
import { ROLES, Role } from './accounts.constants';

export type AppUser = { id: string; email: string; role: Role };

const UNIQUE_VIOLATION = '23505';

@Injectable()
export class AccountsService {
  // Hash of a throwaway password, compared against when the email is unknown so both failures cost the same.
  private dummyHash?: Promise<string>;

  constructor(
    private readonly db: DatabaseService,
    private readonly passwords: PasswordService,
  ) {}

  /** The user for these credentials, or null. Only `app_users` is read, never `players` or `staff_accounts`. */
  async authenticate(email: unknown, password: unknown): Promise<AppUser | null> {
    const candidate =
      typeof password === 'string' && password.length <= MAX_PASSWORD_LENGTH ? password : '';
    const { rows } = await this.db.pool.query(
      'select id, email, role, password_hash from app_users where email = $1',
      [normaliseEmail(email)],
    );
    const row = rows[0] as (AppUser & { password_hash: string }) | undefined;
    if (!row) {
      this.dummyHash ??= this.passwords.hash('unused-dummy-password');
      await this.passwords.verify(await this.dummyHash, candidate);
      return null;
    }
    return (await this.passwords.verify(row.password_hash, candidate))
      ? { id: row.id, email: row.email, role: row.role }
      : null;
  }

  async create(email: unknown, password: unknown, role: unknown): Promise<AppUser> {
    const fields = await this.validated(email, password, role);
    try {
      const { rows } = await this.db.pool.query(
        'insert into app_users (email, password_hash, role) values ($1, $2, $3) returning id, email, role',
        fields,
      );
      return rows[0] as AppUser;
    } catch (err) {
      if ((err as { code?: string }).code === UNIQUE_VIOLATION) {
        throw new ConflictException('An account with this email already exists.');
      }
      throw err;
    }
  }

  /** Deployment seed: creates the super-admin, or does nothing when the email already exists. */
  async ensureSuperAdmin(email: unknown, password: unknown): Promise<'created' | 'exists'> {
    const fields = await this.validated(email, password, 'super_admin');
    const { rows } = await this.db.pool.query(
      'insert into app_users (email, password_hash, role) values ($1, $2, $3) on conflict (email) do nothing returning id',
      fields,
    );
    return rows.length > 0 ? 'created' : 'exists';
  }

  /** Every account, oldest first, without hashes. */
  async list(): Promise<AppUser[]> {
    const { rows } = await this.db.pool.query(
      'select id, email, role from app_users order by created_at, email',
    );
    return rows as AppUser[];
  }

  private async validated(
    email: unknown,
    password: unknown,
    role: unknown,
  ): Promise<[string, string, Role]> {
    const normalised = normaliseEmail(email);
    if (!EMAIL_PATTERN.test(normalised)) {
      throw new BadRequestException('Enter an email like name@example.com');
    }
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(`Use at least ${MIN_PASSWORD_LENGTH} characters`);
    }
    if (password.length > MAX_PASSWORD_LENGTH) {
      throw new BadRequestException(`Use at most ${MAX_PASSWORD_LENGTH} characters`);
    }
    if (typeof role !== 'string' || !(ROLES as readonly string[]).includes(role)) {
      throw new BadRequestException('Choose one role: super-admin, staff or fundraising consultant');
    }
    return [normalised, await this.passwords.hash(password), role as Role];
  }
}
