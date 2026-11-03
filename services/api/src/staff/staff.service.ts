import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { PasswordService } from '../players/password.service';
import {
  EMAIL_PATTERN,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from '../players/players.constants';
import { normaliseEmail } from '../players/players.service';

export type StaffMember = { id: string; email: string };

const UNIQUE_VIOLATION = '23505';

@Injectable()
export class StaffService {
  // Hash of a throwaway password, compared against when the email is unknown so both failures cost the same.
  private dummyHash?: Promise<string>;

  constructor(
    private readonly db: DatabaseService,
    private readonly passwords: PasswordService,
  ) {}

  /** The staff member for these credentials, or null. Only `staff_accounts` is read, never `players`. */
  async authenticate(email: unknown, password: unknown): Promise<StaffMember | null> {
    const candidate =
      typeof password === 'string' && password.length <= MAX_PASSWORD_LENGTH ? password : '';
    const { rows } = await this.db.pool.query(
      'select id, email, password_hash from staff_accounts where email = $1',
      [normaliseEmail(email)],
    );
    const row = rows[0] as (StaffMember & { password_hash: string }) | undefined;
    if (!row) {
      this.dummyHash ??= this.passwords.hash('unused-dummy-password');
      await this.passwords.verify(await this.dummyHash, candidate);
      return null;
    }
    return (await this.passwords.verify(row.password_hash, candidate))
      ? { id: row.id, email: row.email }
      : null;
  }

  /** Run by an operator (scripts/create-staff.ts); there is no in-app way to create staff. */
  async create(email: unknown, password: unknown): Promise<StaffMember> {
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
    try {
      const { rows } = await this.db.pool.query(
        'insert into staff_accounts (email, password_hash) values ($1, $2) returning id, email',
        [normalised, await this.passwords.hash(password)],
      );
      return rows[0] as StaffMember;
    } catch (err) {
      if ((err as { code?: string }).code === UNIQUE_VIOLATION) {
        throw new ConflictException('A staff account with this email already exists.');
      }
      throw err;
    }
  }
}
