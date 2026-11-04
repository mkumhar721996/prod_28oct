-- Customer bank accounts. Freeze state lives on the account row, so one row lock decides both
-- "is it frozen" and "may money move" (see TransfersService and AccountsService).
create sequence if not exists account_number_seq;

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players (id),
  number text not null unique default ('ACC-' || lpad(nextval('account_number_seq')::text, 4, '0')),
  balance_credits bigint not null default 0 check (balance_credits >= 0),
  frozen_at timestamptz,
  frozen_by uuid references staff_accounts (id),
  freeze_reason text,
  created_at timestamptz not null default now(),
  check ((frozen_at is null) = (freeze_reason is null))
);

create index if not exists accounts_player_id_idx on accounts (player_id);

-- The record of staff actions: who froze or unfroze which account, when, and why.
create table if not exists account_freeze_events (
  id bigserial primary key,
  account_id uuid not null references accounts (id),
  staff_id uuid not null references staff_accounts (id),
  action text not null check (action in ('freeze', 'unfreeze')),
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists account_freeze_events_account_id_idx on account_freeze_events (account_id);

-- Backfill: one account per existing player that has none. Safe to re-run.
insert into accounts (player_id)
select p.id from players p
where not exists (select 1 from accounts a where a.player_id = p.id);
