-- A customer's in-app alert. Today only kind 'money_received', created by the background worker.
-- read_at is null while unread; marking read keeps the first read time, so it is idempotent.
create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players (id),
  kind text not null,
  event_id text not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null,
  sender_name text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- One alert per customer, kind and event: processing the same event again inserts nothing.
create unique index if not exists alerts_player_event_uniq
  on alerts (player_id, kind, event_id);

-- The list, newest first.
create index if not exists alerts_player_created_idx
  on alerts (player_id, created_at desc, id desc);

-- The unread count.
create index if not exists alerts_player_unread_idx
  on alerts (player_id) where read_at is null;
