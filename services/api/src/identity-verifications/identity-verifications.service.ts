import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  ALREADY_DECIDED_MESSAGE,
  ALREADY_SUBMITTED_MESSAGE,
  REASON_REQUIRED_MESSAGE,
} from './identity-verifications.constants';

export type SubmissionStatus = 'pending' | 'approved' | 'rejected';

export type Submission = {
  id: string;
  playerId: string;
  fullName: string;
  /** yyyy-mm-dd */
  dateOfBirth: string;
  idNumber: string;
  status: SubmissionStatus;
  rejectionReason: string | null;
  /** The deciding staff member's email (staff accounts have no name). */
  decidedBy: string | null;
  decidedAt: string | null;
  submittedAt: string;
};

export type Decision = { kind: 'approve' } | { kind: 'reject'; reason: unknown };

type Row = {
  id: string;
  player_id: string;
  full_name: string;
  date_of_birth: string;
  id_number: string;
  status: SubmissionStatus;
  rejection_reason: string | null;
  decided_by_email: string | null;
  decided_at: Date | null;
  submitted_at: Date;
};

const SELECT = `select s.id, s.player_id, s.full_name, to_char(s.date_of_birth, 'YYYY-MM-DD') as date_of_birth,
  s.id_number, s.status, s.rejection_reason, st.email as decided_by_email, s.decided_at, s.submitted_at
  from identity_submissions s left join staff_accounts st on st.id = s.decided_by`;

const UNIQUE_VIOLATION = '23505';

@Injectable()
export class IdentityVerificationsService {
  constructor(private readonly db: DatabaseService) {}

  /** Undecided submissions, oldest first. */
  async listPending(): Promise<Submission[]> {
    const { rows } = await this.db.pool.query(
      `${SELECT} where s.status = 'pending' order by s.submitted_at, s.id`,
    );
    return rows.map(view);
  }

  /** Approved and rejected submissions, newest decision first. */
  async listDecided(): Promise<Submission[]> {
    const { rows } = await this.db.pool.query(
      `${SELECT} where s.status in ('approved', 'rejected') order by s.decided_at desc, s.id desc`,
    );
    return rows.map(view);
  }

  async get(id: string): Promise<Submission | null> {
    const { rows } = await this.db.pool.query(`${SELECT} where s.id = $1`, [id]);
    return rows[0] ? view(rows[0]) : null;
  }

  /**
   * Decides a pending submission and alerts the customer, in one transaction. The conditional update is what
   * refuses a second decision, so two staff members racing can never overwrite each other.
   */
  async decide(id: string, staffId: string, decision: Decision): Promise<Submission> {
    const reason = decision.kind === 'reject' ? cleanReason(decision.reason) : null;
    const status = decision.kind === 'approve' ? 'approved' : 'rejected';
    const client = await this.db.pool.connect();
    try {
      await client.query('begin');
      const { rows } = await client.query(
        `update identity_submissions set status = $2, rejection_reason = $3, decided_by = $4, decided_at = now()
         where id = $1 and status = 'pending' returning player_id`,
        [id, status, reason, staffId],
      );
      if (!rows[0]) {
        const exists = await client.query('select 1 from identity_submissions where id = $1', [id]);
        throw exists.rows[0] ? new ConflictException(ALREADY_DECIDED_MESSAGE) : new NotFoundException('Submission not found.');
      }
      await client.query(
        `insert into alerts (player_id, kind, event_id) values ($1, $2, $3) on conflict (kind, event_id) do nothing`,
        [rows[0].player_id, `identity_${status}`, `identity:${id}:${status}`],
      );
      await client.query('commit');
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
    return (await this.get(id))!;
  }

  /** The customer's most recent submission, if any. */
  async latestFor(playerId: string): Promise<Submission | null> {
    const { rows } = await this.db.pool.query(
      `${SELECT} where s.player_id = $1 order by s.submitted_at desc, s.id desc limit 1`,
      [playerId],
    );
    return rows[0] ? view(rows[0]) : null;
  }

  /** A new pending submission; refused while the latest one is pending or approved. */
  async submit(
    playerId: string,
    details: { fullName: unknown; dateOfBirth: unknown; idNumber: unknown },
  ): Promise<Submission> {
    const fullName = required(details.fullName, 'Enter your full name.');
    const idNumber = required(details.idNumber, 'Enter your ID number.');
    const dateOfBirth = pastDate(details.dateOfBirth);
    const latest = await this.latestFor(playerId);
    if (latest && latest.status !== 'rejected') throw new ConflictException(ALREADY_SUBMITTED_MESSAGE);
    try {
      const { rows } = await this.db.pool.query(
        `insert into identity_submissions (player_id, full_name, date_of_birth, id_number)
         values ($1, $2, $3, $4) returning id`,
        [playerId, fullName, dateOfBirth, idNumber],
      );
      return (await this.get(rows[0].id))!;
    } catch (err) {
      if ((err as { code?: string }).code === UNIQUE_VIOLATION) throw new ConflictException(ALREADY_SUBMITTED_MESSAGE);
      throw err;
    }
  }
}

function cleanReason(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') throw new BadRequestException(REASON_REQUIRED_MESSAGE);
  return value.trim();
}

function required(value: unknown, message: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new BadRequestException(message);
  return value.trim();
}

const DATE_MESSAGE = 'Enter your date of birth as a real date in the past, like 1988-03-14.';

function pastDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) throw new BadRequestException(DATE_MESSAGE);
  const iso = value.trim();
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== iso || parsed >= new Date()) {
    throw new BadRequestException(DATE_MESSAGE);
  }
  return iso;
}

function view(r: Row): Submission {
  return {
    id: String(r.id),
    playerId: r.player_id,
    fullName: r.full_name,
    dateOfBirth: r.date_of_birth,
    idNumber: r.id_number,
    status: r.status,
    rejectionReason: r.rejection_reason,
    decidedBy: r.decided_by_email,
    decidedAt: r.decided_at ? r.decided_at.toISOString() : null,
    submittedAt: r.submitted_at.toISOString(),
  };
}
