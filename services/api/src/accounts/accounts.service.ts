import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AccountKind } from './accounts.constants';

export type Account = { id: string; kind: AccountKind; balance: number; frozen: boolean };

@Injectable()
export class AccountsService {
  constructor(private readonly db: DatabaseService) {}

  /** The player's own accounts, checking first. */
  async listFor(playerId: string): Promise<Account[]> {
    const { rows } = await this.db.pool.query(
      'select id, kind, balance, frozen from accounts where player_id = $1 order by kind',
      [playerId],
    );
    return rows.map((r) => ({
      id: String(r.id),
      kind: r.kind as AccountKind,
      balance: Number(r.balance),
      frozen: Boolean(r.frozen),
    }));
  }
}
