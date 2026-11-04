-- A customer's submitted ID details and staff's decision on them. A rejected customer resubmits as a NEW row,
-- so the first decision (who, when, why) is never overwritten.
create table if not exists identity_submissions (
  id bigserial primary key,
  player_id uuid not null references players (id),
  full_name text not null,
  date_of_birth date not null,
  id_number text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text,
  decided_by uuid references staff_accounts (id),
  decided_at timestamptz,
  submitted_at timestamptz not null default now(),
  check (status <> 'rejected' or length(btrim(coalesce(rejection_reason, ''))) > 0),
  check (status = 'pending' or (decided_by is not null and decided_at is not null))
);

-- One pending submission per customer: the backstop for a double submit.
create unique index if not exists identity_submissions_one_pending_idx
  on identity_submissions (player_id) where status = 'pending';

-- The Pending and Decided lists.
create index if not exists identity_submissions_status_idx on identity_submissions (status, submitted_at);

-- The customer's status page: their latest submission.
create index if not exists identity_submissions_player_idx
  on identity_submissions (player_id, submitted_at desc, id desc);

-- Alerts also carry identity decisions. Swap the kind check (looked up by definition, not by name).
do $$
declare
  c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'alerts'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%kind%'
  loop
    execute format('alter table alerts drop constraint %I', c);
  end loop;
end $$;

alter table alerts
  add constraint alerts_kind_check check (kind in ('money_received', 'identity_approved', 'identity_rejected'));
