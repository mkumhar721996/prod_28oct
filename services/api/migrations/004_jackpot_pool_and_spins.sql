-- The jackpot pool is one shared row holding the four tiers as integer cents, so the amounts stay exact
-- (25 x 5% x 30% = 0.375 stores as 38 cents). Seeded at 0; the tier amounts must match game.constants.ts.
create table if not exists jackpot_pool (
  id smallint primary key check (id = 1),
  mini_cents bigint not null default 0 check (mini_cents >= 0),
  minor_cents bigint not null default 0 check (minor_cents >= 0),
  major_cents bigint not null default 0 check (major_cents >= 0),
  grand_cents bigint not null default 0 check (grand_cents >= 0)
);
insert into jackpot_pool (id) values (1) on conflict (id) do nothing;

-- Append-only audit of every spin. The credits move through wallet_entries in the same transaction.
-- The allowed bets must match BETS in game.constants.ts.
create table if not exists spins (
  id bigserial primary key,
  player_id uuid not null references players (id),
  bet_credits integer not null check (bet_credits in (10, 25, 50, 100, 250)),
  win_credits bigint not null default 0 check (win_credits >= 0),
  reels text not null,
  created_at timestamptz not null default now()
);
create index if not exists spins_player_created_idx on spins (player_id, created_at desc, id desc);
