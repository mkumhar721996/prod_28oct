-- Append-only wallet ledger: one row per welcome bonus (grant), bet, win and top-up. Never deleted.
create table if not exists wallet_entries (
  id bigserial primary key,
  player_id uuid not null references players (id),
  kind text not null check (kind in ('grant', 'bet', 'win', 'topup')),
  amount_credits bigint not null check (amount_credits >= 1),
  balance_after_credits bigint not null check (balance_after_credits >= 0),
  created_at timestamptz not null default now()
);

create index if not exists wallet_entries_player_created_idx
  on wallet_entries (player_id, created_at desc, id desc);

-- A player gets exactly one welcome bonus, which also makes the backfill below safe to re-run.
create unique index if not exists wallet_entries_one_grant_idx
  on wallet_entries (player_id) where kind = 'grant';

-- Existing players: their starting 1,000-credit grant (no feature changed a balance before this).
insert into wallet_entries (player_id, kind, amount_credits, balance_after_credits, created_at)
select p.id, 'grant', 1000, 1000, p.created_at
  from players p
 where not exists (select 1 from wallet_entries e where e.player_id = p.id and e.kind = 'grant');
