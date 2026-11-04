import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export type TransferRefusal =
  | 'invalid_amount'
  | 'same_account'
  | 'not_found'
  | 'account_frozen'
  | 'insufficient_balance';
export type TransferResult = { ok: true } | { ok: false; reason: TransferRefusal };

@Injectable()
export class TransfersService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Both account rows are locked `for update` in id order (so two transfers cannot deadlock) and
   * the freeze is read under that lock. A freeze that committed first refuses the transfer; a
   * transfer that committed first is settled and the freeze applies to every later one.
   */
  async transfer(
    playerId: string,
    fromId: string,
    toId: string,
    amount: unknown,
  ): Promise<TransferResult> {
    if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount < 1) {
      return { ok: false, reason: 'invalid_amount' };
    }
    if (fromId === toId) return { ok: false, reason: 'same_account' };
    const client = await this.db.pool.connect();
    try {
      await client.query('begin');
      const { rows } = await client.query(
        'select id, player_id, balance_credits, frozen_at from accounts where id = any($1) order by id for update',
        [[fromId, toId]],
      );
      const from = rows.find((r) => r.id === fromId);
      const to = rows.find((r) => r.id === toId);
      const refusal = this.refusal(playerId, from, to, amount);
      if (refusal) {
        await client.query('rollback');
        return { ok: false, reason: refusal };
      }
      await client.query('update accounts set balance_credits = balance_credits - $2 where id = $1', [fromId, amount]);
      await client.query('update accounts set balance_credits = balance_credits + $2 where id = $1', [toId, amount]);
      await client.query('commit');
      return { ok: true };
    } catch (err) {
      await client.query('rollback').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  private refusal(
    playerId: string,
    from: Record<string, unknown> | undefined,
    to: Record<string, unknown> | undefined,
    amount: number,
  ): TransferRefusal | null {
    if (!from || !to || from.player_id !== playerId) return 'not_found';
    if (from.frozen_at != null || to.frozen_at != null) return 'account_frozen';
    if (Number(from.balance_credits) < amount) return 'insufficient_balance';
    return null;
  }
}
