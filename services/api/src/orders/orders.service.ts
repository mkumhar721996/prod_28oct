import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { addressError, isText, isValidLine, LIMITS, phoneError } from './orders.validation';

export type OrderLineInput = { id: string; name: string; unitPrice: number; quantity: number };
export type PlaceOrderInput = {
  fulfilment: 'delivery' | 'collection';
  name: string;
  phone: string;
  address?: string;
  lines: OrderLineInput[];
  idempotencyKey: string;
};
export type PlaceOrderResult =
  | { ok: true; order: { id: string; number: string }; replayed: boolean }
  | { ok: false; code: 'invalid' | 'empty_cart' };

type Row = { id: string; number: number };

@Injectable()
export class OrdersService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Refuses invalid input before any query runs. The (player, key) unique index makes a repeated
   * submission land on the existing order instead of creating a second one. Line prices are the
   * client's display-only snapshot.
   */
  async place(playerId: string, input: PlaceOrderInput): Promise<PlaceOrderResult> {
    if (!Array.isArray(input.lines) || input.lines.length === 0) return { ok: false, code: 'empty_cart' };
    const delivery = input.fulfilment === 'delivery';
    const valid =
      (delivery || input.fulfilment === 'collection') &&
      input.lines.length <= LIMITS.lines &&
      isText(input.name, LIMITS.name) &&
      isText(input.phone, LIMITS.phone) &&
      !phoneError(input.phone) &&
      (!delivery ||
        (isText(input.address, LIMITS.address) && !addressError(input.address))) &&
      input.lines.every(isValidLine) &&
      isText(input.idempotencyKey, LIMITS.idempotencyKey);
    if (!valid) return { ok: false, code: 'invalid' };

    const { rows } = await this.db.pool.query(
      `insert into orders (player_id, fulfilment, name, phone, address, lines, idempotency_key)
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (player_id, idempotency_key) do nothing
       returning id, number`,
      [
        playerId,
        input.fulfilment,
        input.name.trim(),
        input.phone.trim(),
        delivery ? input.address!.trim() : null,
        JSON.stringify(input.lines.map(({ id, name, unitPrice, quantity }) => ({ id, name, unitPrice, quantity }))),
        input.idempotencyKey,
      ],
    );
    if (rows[0]) return { ok: true, order: this.view(rows[0]), replayed: false };
    const existing = await this.db.pool.query(
      'select id, number from orders where player_id = $1 and idempotency_key = $2',
      [playerId, input.idempotencyKey],
    );
    return { ok: true, order: this.view(existing.rows[0]), replayed: true };
  }

  private view(row: Row) {
    return { id: row.id, number: String(row.number) };
  }
}
