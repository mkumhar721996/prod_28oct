-- A customer's in-app alert. Today only kind 'money_received', written by the background worker.
-- read_at is null while unread; marking read keeps the first read time, so it is idempotent.
create table if not exists alerts (
  id bigserial primary key,
  player_id uuid not null references players (id),
  kind text not null check (kind in ('money_received')),
  event_id text not null,
  amount_minor bigint check (amount_minor >= 1),
  currency text,
  sender_name text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

-- One alert per event: processing the same event again inserts nothing. Also makes worker retries safe.
create unique index if not exists alerts_event_id_idx on alerts (kind, event_id);

-- The list, newest first.
create index if not exists alerts_player_created_idx on alerts (player_id, created_at desc, id desc);

-- The unread count.
create index if not exists alerts_player_unread_idx on alerts (player_id) where read_at is null;
