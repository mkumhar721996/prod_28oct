-- Simulated bank accounts: one checking and one savings account per player. Whole units, no cents.
create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players (id),
  kind text not null check (kind in ('checking', 'savings')),
  balance bigint not null default 0 check (balance >= 0),
  frozen boolean not null default false,
  unique (player_id, kind)
);

-- One row per completed transfer. The unique key makes a repeated confirmation a no-op.
create table if not exists transfers (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players (id),
  from_account_id uuid not null references accounts (id),
  to_account_id uuid not null references accounts (id),
  amount bigint not null check (amount >= 1),
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  check (from_account_id <> to_account_id),
  unique (player_id, idempotency_key)
);

-- Append-only audit trail. Never deleted.
create table if not exists audit_records (
  id bigserial primary key,
  kind text not null,
  player_id uuid,
  transfer_id uuid references transfers (id),
  details jsonb not null,
  created_at timestamptz not null default now()
);

-- Existing players: one account of each kind (safe to re-run).
insert into accounts (player_id, kind)
select p.id, k.kind
  from players p
 cross join (values ('checking'), ('savings')) as k (kind)
 where not exists (select 1 from accounts a where a.player_id = p.id and a.kind = k.kind);
