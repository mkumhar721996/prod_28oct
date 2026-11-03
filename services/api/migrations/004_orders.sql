-- Rules that must stay in sync with services/api/src/orders/orders.validation.ts (pinned by orders.service.spec.ts):
-- fulfilment is delivery or collection; a delivery order has an address and a collection order has none.
-- A customer's order: contact details, how it is fulfilled and a snapshot of the cart lines.
-- Line prices are the client's display-only snapshot; no total is stored.
create sequence if not exists orders_number_seq start 1001;

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players (id),
  number integer not null default nextval('orders_number_seq'),
  fulfilment text not null check (fulfilment in ('delivery', 'collection')),
  name text not null,
  phone text not null,
  address text,
  lines jsonb not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  check ((fulfilment = 'delivery' and address is not null) or (fulfilment = 'collection' and address is null))
);

-- The display number is never handed out twice.
create unique index if not exists orders_number_uniq
  on orders (number);

-- A repeated submission (same customer, same key) lands on the existing order.
create unique index if not exists orders_player_idem_uniq
  on orders (player_id, idempotency_key);
