import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { topUpCredits } from './wallet.config';
import { HISTORY_PAGE_SIZE, HISTORY_WINDOW_DAYS, MIN_BET } from './wallet.constants';

export type WalletRefusal = 'invalid_amount' | 'insufficient_balance' | 'balance_not_low';
export type WalletResult =
  | { ok: true; balanceCredits: number }
  | { ok: false; reason: WalletRefusal };

export type EntryKind = 'grant' | 'bet' | 'win' | 'topup';
export type HistoryRange = 'recent' | 'all';
export type HistoryEntry = {
  id: string;
  kind: EntryKind;
  amountCredits: number;
  balanceCredits: number;
  createdAt: string;
};
export type History = {
  entries: HistoryEntry[];
  page: number;
  pageCount: number;
  total: number;
  range: HistoryRange;
};

const DAY_MS = 86_400_000;

@Injectable()
export class WalletService {
  /** Resolved once, so a bad setting is warned about once at API start. */
  readonly topUpCredits: number = topUpCredits();

  constructor(private readonly db: DatabaseService) {}

  /** Balance of the given player's own wallet; 0 when none exists. */
  async balanceFor(playerId: string): Promise<number> {
    const { rows } = await this.db.pool.query(
      'select balance_credits from wallets where player_id = $1',
      [playerId],
    );
    return rows[0] ? Number(rows[0].balance_credits) : 0;
  }

  /** For the future Play feature: accepted whenever the bet is no larger than the balance. */
  placeBet(playerId: string, amount: unknown): Promise<WalletResult> {
    return this.change(
      playerId,
      amount,
      'bet',
      'update wallets set balance_credits = balance_credits - $2 where player_id = $1 and balance_credits >= $2 returning balance_credits',
      'insufficient_balance',
    );
  }

  /** For the future Play feature. */
  recordWin(playerId: string, amount: unknown): Promise<WalletResult> {
    return this.change(
      playerId,
      amount,
      'win',
      'update wallets set balance_credits = balance_credits + $2 where player_id = $1 returning balance_credits',
      'insufficient_balance',
    );
  }

  /** Free top-up: allowed whenever the balance is 1 or less. */
  claimTopUp(playerId: string): Promise<WalletResult> {
    return this.change(
      playerId,
      this.topUpCredits,
      'topup',
      'update wallets set balance_credits = balance_credits + $2 where player_id = $1 and balance_credits <= 1 returning balance_credits',
      'balance_not_low',
    );
  }

  /** The player's own ledger entries, newest first; `recent` hides (never deletes) entries older than 30 days. */
  async historyFor(
    playerId: string,
    { page, range }: { page: number; range: HistoryRange },
    now: Date = new Date(),
  ): Promise<History> {
    const params: unknown[] = [playerId];
    let filter = '';
    if (range === 'recent') {
      params.push(new Date(now.getTime() - HISTORY_WINDOW_DAYS * DAY_MS));
      filter = ' and created_at >= $2';
    }
    const where = `where player_id = $1${filter}`;
    const count = await this.db.pool.query(
      `select count(*) as total from wallet_entries ${where}`,
      params,
    );
    const total = Number(count.rows[0].total);
    const { rows } = await this.db.pool.query(
      `select id, kind, amount_credits, balance_after_credits, created_at from wallet_entries ${where}
       order by created_at desc, id desc limit $${params.length + 1} offset $${params.length + 2}`,
      [...params, HISTORY_PAGE_SIZE, (page - 1) * HISTORY_PAGE_SIZE],
    );
    return {
      entries: rows.map((r) => ({
        id: String(r.id),
        kind: r.kind as EntryKind,
        amountCredits: Number(r.amount_credits),
        balanceCredits: Number(r.balance_after_credits),
        createdAt: new Date(r.created_at).toISOString(),
      })),
      page,
      pageCount: Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE)),
      total,
      range,
    };
  }

  /**
   * The one atomic step: a single conditional UPDATE (its row lock serialises concurrent callers)
   * and the ledger row, in one transaction.
   */
  private async change(
    playerId: string,
    amount: unknown,
    kind: Exclude<EntryKind, 'grant'>,
    updateSql: string,
    refusal: WalletRefusal,
  ): Promise<WalletResult> {
    if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount < MIN_BET) {
      return { ok: false, reason: 'invalid_amount' };
    }
    const client: PoolClient = await this.db.pool.connect();
    try {
      await client.query('begin');
      const { rows } = await client.query(updateSql, [playerId, amount]);
      if (!rows[0]) {
        await client.query('rollback');
        return { ok: false, reason: refusal };
      }
      const balanceCredits = Number(rows[0].balance_credits);
      await client.query(
        'insert into wallet_entries (player_id, kind, amount_credits, balance_after_credits) values ($1, $2, $3, $4)',
        [playerId, kind, amount, balanceCredits],
      );
      await client.query('commit');
      return { ok: true, balanceCredits };
    } catch (err) {
      await client.query('rollback').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }
}
