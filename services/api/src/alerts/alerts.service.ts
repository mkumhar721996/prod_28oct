import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export type AlertView = {
  id: string;
  kind: 'money_received';
  amountMinor: number;
  currency: string;
  senderName: string;
  read: boolean;
  createdAt: string;
};

type Row = {
  id: string;
  kind: 'money_received';
  amount_minor: string | number;
  currency: string;
  sender_name: string;
  read_at: Date | null;
  created_at: Date;
};

const COLUMNS = 'id, kind, amount_minor, currency, sender_name, read_at, created_at';

@Injectable()
export class AlertsService {
  constructor(private readonly db: DatabaseService) {}

  /** The customer's own alerts, newest first. */
  async listFor(playerId: string): Promise<AlertView[]> {
    const { rows } = await this.db.pool.query(
      `select ${COLUMNS} from alerts where player_id = $1 order by created_at desc, id desc`,
      [playerId],
    );
    return rows.map(view);
  }

  /** Always counted from the database, so concurrent sessions agree. */
  async unreadCountFor(playerId: string): Promise<number> {
    const { rows } = await this.db.pool.query(
      'select count(*) from alerts where player_id = $1 and read_at is null',
      [playerId],
    );
    return Number(rows[0].count);
  }

  /** Idempotent; null when the alert does not exist or belongs to another customer. */
  async markRead(playerId: string, id: string): Promise<AlertView | null> {
    const { rows } = await this.db.pool.query(
      `update alerts set read_at = coalesce(read_at, now()) where id = $1 and player_id = $2 returning ${COLUMNS}`,
      [id, playerId],
    );
    return rows[0] ? view(rows[0]) : null;
  }
}

function view(r: Row): AlertView {
  return {
    id: r.id,
    kind: r.kind,
    amountMinor: Number(r.amount_minor),
    currency: r.currency,
    senderName: r.sender_name,
    read: r.read_at !== null,
    createdAt: r.created_at.toISOString(),
  };
}
