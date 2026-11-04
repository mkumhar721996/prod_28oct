-- Bank staff are NOT players: separate tables mean a customer row can never authenticate as staff.
-- There is a single staff role, so no role column.
create table if not exists staff_accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

-- last_activity_at slides on every back-office request; the idle limit (15 minutes) is STAFF_IDLE_MS in staff.constants.ts.
create table if not exists staff_sessions (
  token_hash text primary key,
  staff_id uuid not null references staff_accounts (id),
  last_activity_at timestamptz not null default now()
);

create index if not exists staff_sessions_staff_id_idx on staff_sessions (staff_id);
