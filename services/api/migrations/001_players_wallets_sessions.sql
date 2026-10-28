create extension if not exists pgcrypto;

-- Emails are stored trimmed and lowercased; the unique index is what refuses duplicates.
create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

-- One wallet per player (player_id is the primary key); it is created with the starting grant.
create table if not exists wallets (
  player_id uuid primary key references players (id),
  balance_credits bigint not null check (balance_credits >= 0)
);

create table if not exists sessions (
  token_hash text primary key,
  player_id uuid not null references players (id),
  expires_at timestamptz not null
);

create index if not exists sessions_player_id_idx on sessions (player_id);
