import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { ACCOUNT_SEARCH_LIMIT } from './accounts.constants';

export type AccountView = {
  id: string;
  number: string;
  customerEmail: string;
  balanceCredits: number;
  frozen: boolean;
  frozenAt: string | null;
  frozenBy: string | null;
  freezeReason: string | null;
};

export type FreezeResult =
  | { ok: true; account: AccountView }
  | { ok: false; reason: 'reason_required' | 'not_found' | 'already_frozen' };

const SELECT_VIEW = `select a.id, a.number, p.email, a.balance_credits, a.frozen_at,
  s.email as frozen_by_email, a.freeze_reason
  from accounts a
  join players p on p.id = a.player_id
  left join staff_accounts s on s.id = a.frozen_by`;

type Queryable = Pick<PoolClient, 'query'>;

function toView(r: Record<string, unknown>): AccountView {
  return {
    id: String(r.id),
    number: String(r.number),
    customerEmail: String(r.email),
    balanceCredits: Number(r.balance_credits),
    frozen: r.frozen_at != null,
    frozenAt: r.frozen_at ? new Date(r.frozen_at as string | Date).toISOString() : null,
    frozenBy: (r.frozen_by_email as string | null) ?? null,
    freezeReason: (r.freeze_reason as string | null) ?? null,
  };
}

@Injectable()
export class AccountsService {
  constructor(private readonly db: DatabaseService) {}

  /** Accounts whose customer email or number contains the query, capped. */
  async search(query: string): Promise<AccountView[]> {
    const { rows } = await this.db.pool.query(
      `${SELECT_VIEW} where p.email ilike $1 or a.number ilike $1 order by a.number limit $2`,
      [`%${query.trim()}%`, ACCOUNT_SEARCH_LIMIT],
    );
    return rows.map(toView);
  }

  async get(id: string): Promise<AccountView | null> {
    return this.read(this.db.pool, id);
  }

  /** Refuses a blank reason before the database is touched. Freezes only the one account. */
  async freeze(accountId: string, staffId: string, reason: unknown): Promise<FreezeResult> {
    const trimmed = typeof reason === 'string' ? reason.trim() : '';
    if (!trimmed) return { ok: false, reason: 'reason_required' };
    return this.change(
      accountId,
      staffId,
      'freeze',
      trimmed,
      'update accounts set frozen_at = now(), frozen_by = $2, freeze_reason = $3 where id = $1 and frozen_at is null returning id',
      [accountId, staffId, trimmed],
      'already_frozen',
    );
  }

  /** Any signed-in staff member may unfreeze; no reason is needed. */
  async unfreeze(accountId: string, staffId: string): Promise<FreezeResult> {
    return this.change(
      accountId,
      staffId,
      'unfreeze',
      null,
      'update accounts set frozen_at = null, frozen_by = null, freeze_reason = null where id = $1 and frozen_at is not null returning id',
      [accountId],
      null,
    );
  }

  /**
   * The conditional UPDATE takes the account's row lock, the same lock a transfer holds while it
   * checks the freeze, so a freeze and a transfer on one account run one after the other.
   */
  private async change(
    accountId: string,
    staffId: string,
    action: 'freeze' | 'unfreeze',
    reason: string | null,
    updateSql: string,
    updateParams: unknown[],
    unchanged: 'already_frozen' | null,
  ): Promise<FreezeResult> {
    const client = await this.db.pool.connect();
    try {
      await client.query('begin');
      const { rows } = await client.query(updateSql, updateParams);
      if (rows[0]) {
        await client.query(
          'insert into account_freeze_events (account_id, staff_id, action, reason) values ($1, $2, $3, $4)',
          [accountId, staffId, action, reason],
        );
      }
      const account = await this.read(client, accountId);
      if (!rows[0]) {
        await client.query('rollback');
        if (!account) return { ok: false, reason: 'not_found' };
        if (unchanged) return { ok: false, reason: unchanged };
        return { ok: true, account };
      }
      await client.query('commit');
      return { ok: true, account: account as AccountView };
    } catch (err) {
      await client.query('rollback').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  private async read(db: Queryable, id: string): Promise<AccountView | null> {
    const { rows } = await db.query(`${SELECT_VIEW} where a.id = $1`, [id]);
    return rows[0] ? toView(rows[0]) : null;
  }
}
