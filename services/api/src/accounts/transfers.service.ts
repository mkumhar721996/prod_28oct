import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { MAX_IDEMPOTENCY_KEY_LENGTH, TransferRefusal } from './accounts.constants';

export type AccountBalance = { id: string; balance: number };
export type TransferResult =
  | { ok: true; transferId: string; from: AccountBalance; to: AccountBalance; replayed: boolean }
  | { ok: false; reason: TransferRefusal };

export type TransferInput = {
  fromAccountId: string;
  toAccountId: string;
  amount: unknown;
  idempotencyKey: unknown;
};

/**
 * The shared transfer rules (instant, refused before any money moves, never applied twice, audited).
 * Payee payments reuse this by resolving a payee to a destination account id.
 */
@Injectable()
export class TransfersService {
  constructor(private readonly db: DatabaseService) {}

  async execute(playerId: string, input: TransferInput): Promise<TransferResult> {
    const { fromAccountId, toAccountId, amount, idempotencyKey } = input;
    if (
      typeof amount !== 'number' ||
      !Number.isSafeInteger(amount) ||
      amount < 1 ||
      typeof idempotencyKey !== 'string' ||
      idempotencyKey.length < 1 ||
      idempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH
    ) {
      return { ok: false, reason: 'invalid_amount' };
    }
    if (fromAccountId === toAccountId) return { ok: false, reason: 'same_account' };

    const client: PoolClient = await this.db.pool.connect();
    try {
      await client.query('begin');
      // The key is claimed first: a concurrent or repeated confirmation waits on the unique index,
      // then finds the row already there and changes nothing.
      const claimed = await client.query(
        `insert into transfers (player_id, from_account_id, to_account_id, amount, idempotency_key)
         values ($1, $2, $3, $4, $5)
         on conflict (player_id, idempotency_key) do nothing
         returning id`,
        [playerId, fromAccountId, toAccountId, amount, idempotencyKey],
      );
      if (!claimed.rows[0]) {
        const result = await this.replay(client, playerId, idempotencyKey);
        await client.query('commit');
        return result;
      }
      const transferId = String(claimed.rows[0].id);

      // Locked in id order, so concurrent transfers serialise and cannot deadlock.
      const { rows } = await client.query(
        'select id, balance, frozen from accounts where id = any($1) and player_id = $2 order by id for update',
        [[fromAccountId, toAccountId], playerId],
      );
      const from = rows.find((r) => r.id === fromAccountId);
      const to = rows.find((r) => r.id === toAccountId);
      const refusal = this.refusal(from, to, amount);
      if (refusal || !from || !to) {
        // Rolling back also removes the claimed key, so the same key can be retried after a fix.
        await client.query('rollback');
        return { ok: false, reason: refusal ?? 'not_found' };
      }

      await client.query('update accounts set balance = balance + $1 where id = $2', [-amount, fromAccountId]);
      await client.query('update accounts set balance = balance + $1 where id = $2', [amount, toAccountId]);
      await client.query(
        'insert into audit_records (kind, player_id, transfer_id, details) values ($1, $2, $3, $4)',
        ['transfer.completed', playerId, transferId, JSON.stringify({ from: fromAccountId, to: toAccountId, amount })],
      );
      await client.query('commit');
      return {
        ok: true,
        transferId,
        from: { id: fromAccountId, balance: Number(from.balance) - amount },
        to: { id: toAccountId, balance: Number(to.balance) + amount },
        replayed: false,
      };
    } catch (err) {
      await client.query('rollback').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  private refusal(
    from: { balance: unknown; frozen: boolean } | undefined,
    to: { frozen: boolean } | undefined,
    amount: number,
  ): TransferRefusal | null {
    if (!from || !to) return 'not_found';
    if (from.frozen) return 'source_frozen';
    if (to.frozen) return 'destination_frozen';
    if (Number(from.balance) < amount) return 'insufficient_balance';
    return null;
  }

  /** The stored outcome of an earlier confirmation, with current balances; nothing changes. */
  private async replay(client: PoolClient, playerId: string, key: string): Promise<TransferResult> {
    const { rows } = await client.query(
      `select a.id, a.balance, t.id as transfer_id, t.from_account_id
         from transfers t join accounts a on a.id in (t.from_account_id, t.to_account_id)
        where t.player_id = $1 and t.idempotency_key = $2`,
      [playerId, key],
    );
    const from = rows.find((r) => r.id === r.from_account_id);
    const to = rows.find((r) => r.id !== r.from_account_id);
    return {
      ok: true,
      transferId: String(rows[0].transfer_id),
      from: { id: String(from.id), balance: Number(from.balance) },
      to: { id: String(to.id), balance: Number(to.balance) },
      replayed: true,
    };
  }
}
