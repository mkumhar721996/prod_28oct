import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export type AlertKind = 'money_received' | 'identity_approved' | 'identity_rejected';

/** Identity alerts carry no money, so the amount, currency and sender are null for them. */
export type Alert = {
  id: string;
  kind: AlertKind;
  amountMinor: number | null;
  currency: string | null;
  senderName: string | null;
  createdAt: string;
  read: boolean;
};

type Row = {
  id: string;
  kind: AlertKind;
  amount_minor: string | number | null;
  currency: string | null;
  sender_name: string | null;
  created_at: Date;
  read_at: Date | null;
};

const COLUMNS = 'id, kind, amount_minor, currency, sender_name, created_at, read_at';

@Injectable()
export class AlertsService {
  constructor(private readonly db: DatabaseService) {}

  /** The customer's own alerts, newest first. */
  async listFor(playerId: string): Promise<Alert[]> {
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
  async markRead(playerId: string, id: string): Promise<Alert | null> {
    const { rows } = await this.db.pool.query(
      `update alerts set read_at = coalesce(read_at, now()) where id = $1 and player_id = $2 returning ${COLUMNS}`,
      [id, playerId],
    );
    return rows[0] ? view(rows[0]) : null;
  }
}

function view(r: Row): Alert {
  return {
    id: String(r.id),
    kind: r.kind,
    amountMinor: r.amount_minor === null ? null : Number(r.amount_minor),
    currency: r.currency,
    senderName: r.sender_name,
    createdAt: r.created_at.toISOString(),
    read: r.read_at !== null,
  };
}
