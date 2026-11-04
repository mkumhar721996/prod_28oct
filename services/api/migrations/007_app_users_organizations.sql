-- Back-office users with one role each. Separate from players and staff_accounts so a customer or
-- bank-staff row can never sign in here. A single role column means an account has exactly one role.
create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  role text not null check (role in ('super_admin', 'staff', 'fundraising_consultant')),
  created_at timestamptz not null default now()
);

-- last_activity_at slides on every request; the idle limit is ORG_IDLE_MS in auth.constants.ts.
create table if not exists app_sessions (
  token_hash text primary key,
  user_id uuid not null references app_users (id) on delete cascade,
  last_activity_at timestamptz not null default now()
);

create index if not exists app_sessions_user_id_idx on app_sessions (user_id);

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
