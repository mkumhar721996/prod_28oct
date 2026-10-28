import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class WalletService {
  constructor(private readonly db: DatabaseService) {}

  /** Balance of the given player's own wallet; 0 when none exists. */
  async balanceFor(playerId: string): Promise<number> {
    const { rows } = await this.db.pool.query(
      'select balance_credits from wallets where player_id = $1',
      [playerId],
    );
    return rows[0] ? Number(rows[0].balance_credits) : 0;
  }
}
