import { Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { isBet } from './game.constants';
import { splitContribution } from './jackpot';
import { Reels, drawReels, payoutFor } from './reels';

export type JackpotState = {
  miniCents: number;
  minorCents: number;
  majorCents: number;
  grandCents: number;
  totalCents: number;
};
export type GameState = { balanceCredits: number; jackpot: JackpotState };

export type SpinRefusal = 'invalid_bet' | 'insufficient_balance';
export type SpinResult =
  | {
      ok: true;
      reels: Reels;
      bet: number;
      winCredits: number;
      label: string | null;
      balanceCredits: number;
      jackpot: JackpotState;
    }
  | { ok: false; reason: SpinRefusal; balanceCredits?: number };

const jackpotFrom = (row: Record<string, string | number>): JackpotState => {
  const miniCents = Number(row.mini_cents);
  const minorCents = Number(row.minor_cents);
  const majorCents = Number(row.major_cents);
  const grandCents = Number(row.grand_cents);
  return { miniCents, minorCents, majorCents, grandCents, totalCents: miniCents + minorCents + majorCents + grandCents };
};

@Injectable()
export class GameService {
  constructor(private readonly db: DatabaseService) {}

  /** The player's own balance and the shared jackpot pool. */
  async stateFor(playerId: string): Promise<GameState> {
    const balanceCredits = await this.balanceOf(playerId);
    const pool = await this.db.pool.query(
      'select mini_cents, minor_cents, major_cents, grand_cents from jackpot_pool where id = 1',
    );
    return { balanceCredits, jackpot: jackpotFrom(pool.rows[0]) };
  }

  private async balanceOf(playerId: string): Promise<number> {
    const { rows } = await this.db.pool.query('select balance_credits from wallets where player_id = $1', [
      playerId,
    ]);
    return rows[0] ? Number(rows[0].balance_credits) : 0;
  }

  /**
   * One spin, decided and settled in a single transaction: debit, optional win, ledger rows, the pool
   * contribution and the audit row commit together or not at all, so a dropped connection never leaves
   * a half-settled spin. Lock order is wallet row then pool row, so concurrent spins cannot deadlock.
   */
  async spin(
    playerId: string,
    bet: unknown,
    rng: (max: number) => number = randomInt,
  ): Promise<SpinResult> {
    if (!isBet(bet)) return { ok: false, reason: 'invalid_bet' };
    const client: PoolClient = await this.db.pool.connect();
    try {
      await client.query('begin');
      const debit = await client.query(
        'update wallets set balance_credits = balance_credits - $2 where player_id = $1 and balance_credits >= $2 returning balance_credits',
        [playerId, bet],
      );
      if (!debit.rows[0]) {
        await client.query('rollback');
        return { ok: false, reason: 'insufficient_balance', balanceCredits: await this.balanceOf(playerId) };
      }
      const reels = drawReels(rng);
      const { winCredits, label } = payoutFor(reels, bet);
      const tiers = splitContribution(bet);
      let balanceCredits = Number(debit.rows[0].balance_credits);
      const ledger =
        'insert into wallet_entries (player_id, kind, amount_credits, balance_after_credits) values ($1, $2, $3, $4)';
      await client.query(ledger, [playerId, 'bet', bet, balanceCredits]);
      if (winCredits > 0) {
        const credit = await client.query(
          'update wallets set balance_credits = balance_credits + $2 where player_id = $1 returning balance_credits',
          [playerId, winCredits],
        );
        balanceCredits = Number(credit.rows[0].balance_credits);
        await client.query(ledger, [playerId, 'win', winCredits, balanceCredits]);
      }
      const pool = await client.query(
        `update jackpot_pool set mini_cents = mini_cents + $1, minor_cents = minor_cents + $2,
           major_cents = major_cents + $3, grand_cents = grand_cents + $4
         where id = 1 returning mini_cents, minor_cents, major_cents, grand_cents`,
        [tiers.mini, tiers.minor, tiers.major, tiers.grand],
      );
      await client.query(
        'insert into spins (player_id, bet_credits, win_credits, reels) values ($1, $2, $3, $4)',
        [playerId, bet, winCredits, reels.join(',')],
      );
      await client.query('commit');
      return { ok: true, reels, bet, winCredits, label, balanceCredits, jackpot: jackpotFrom(pool.rows[0]) };
    } catch (err) {
      await client.query('rollback').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }
}
