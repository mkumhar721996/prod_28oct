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

type PoolRow = { mini_cents: string; minor_cents: string; major_cents: string; grand_cents: string };

function jackpotFrom(row: PoolRow): JackpotState {
  const miniCents = Number(row.mini_cents);
  const minorCents = Number(row.minor_cents);
  const majorCents = Number(row.major_cents);
  const grandCents = Number(row.grand_cents);
  return { miniCents, minorCents, majorCents, grandCents, totalCents: miniCents + minorCents + majorCents + grandCents };
}

@Injectable()
export class GameService {
  constructor(private readonly db: DatabaseService) {}

  /** The player's own balance and the shared jackpot pool. */
  async stateFor(playerId: string): Promise<GameState> {
    const wallet = await this.db.pool.query('select balance_credits from wallets where player_id = $1', [playerId]);
    const pool = await this.db.pool.query('select * from jackpot_pool where id = 1');
    return {
      balanceCredits: wallet.rows[0] ? Number(wallet.rows[0].balance_credits) : 0,
      jackpot: jackpotFrom(pool.rows[0]),
    };
  }

  /**
   * One spin, settled entirely in one transaction: debit, reels, win credit, ledger rows, jackpot
   * contribution and the audit row commit together or not at all, so a dropped connection can never
   * leave a half-settled spin. Lock order is wallet row, then pool row, so concurrent spins cannot deadlock.
   * The reels are drawn only once the debit has succeeded.
   */
  async spin(playerId: string, bet: unknown, rng: (max: number) => number = randomInt): Promise<SpinResult> {
    if (!isBet(bet)) return { ok: false, reason: 'invalid_bet' };
    const client: PoolClient = await this.db.pool.connect();
    try {
      await client.query('begin');
      const debit = await client.query(
        'update wallets set balance_credits = balance_credits - $2 where player_id = $1 and balance_credits >= $2 returning balance_credits',
        [playerId, bet],
      );
      if (!debit.rows[0]) {
        const current = await client.query('select balance_credits from wallets where player_id = $1', [playerId]);
        await client.query('rollback');
        return {
          ok: false,
          reason: 'insufficient_balance',
          balanceCredits: current.rows[0] ? Number(current.rows[0].balance_credits) : undefined,
        };
      }
      let balanceCredits = Number(debit.rows[0].balance_credits);
      const reels = drawReels(rng);
      const { winCredits, label } = payoutFor(reels, bet);
      const tiers = splitContribution(bet);

      await this.ledger(client, playerId, 'bet', bet, balanceCredits);
      if (winCredits > 0) {
        const credit = await client.query(
          'update wallets set balance_credits = balance_credits + $2 where player_id = $1 returning balance_credits',
          [playerId, winCredits],
        );
        balanceCredits = Number(credit.rows[0].balance_credits);
        await this.ledger(client, playerId, 'win', winCredits, balanceCredits);
      }
      const pool = await client.query(
        'update jackpot_pool set mini_cents = mini_cents + $1, minor_cents = minor_cents + $2, major_cents = major_cents + $3, grand_cents = grand_cents + $4 where id = 1 returning *',
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

  private ledger(client: PoolClient, playerId: string, kind: 'bet' | 'win', amount: number, balanceAfter: number) {
    return client.query(
      'insert into wallet_entries (player_id, kind, amount_credits, balance_after_credits) values ($1, $2, $3, $4)',
      [playerId, kind, amount, balanceAfter],
    );
  }
}
