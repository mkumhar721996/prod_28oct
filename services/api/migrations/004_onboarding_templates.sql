-- The day-90 limit (90) must match LATEST_DUE_DAY in onboarding-templates.constants.ts and apps/web/src/lib/onboardingTemplates.ts.
-- The owners must match OWNERS in onboarding-templates.constants.ts.

-- Who may write templates: every existing player stays 'player'; HR rows are set in the database for now.
alter table players
  add column if not exists account_role text not null default 'player'
  check (account_role in ('player', 'hr'));

-- One standard onboarding template per job role. Job roles live in code, not in a table.
create table if not exists onboarding_templates (
  id uuid primary key default gen_random_uuid(),
  job_role text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A role has one template; the database refuses a second one, so concurrent creates cannot both win.
create unique index if not exists onboarding_templates_role_uniq
  on onboarding_templates (job_role);

-- due_offset_days is signed: negative is before the start date, 0 the start date, up to +90 after.
-- There is no lower bound: days before the start date are unlimited.
create table if not exists onboarding_template_tasks (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references onboarding_templates (id) on delete cascade,
  position int not null,
  title text not null check (char_length(title) between 1 and 200),
  owner text not null check (owner in ('hiring_manager', 'it', 'new_hire', 'hr')),
  due_offset_days int not null check (due_offset_days <= 90)
);

-- A hire's plan is a copy of its template's tasks taken when the plan is created. Plan tasks are copies
-- by value and have NO foreign key to template tasks, so editing or replacing template tasks can never
-- reach them. Do not add one. The plan-creation story owns writing these tables.
create table if not exists onboarding_plans (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references onboarding_templates (id) on delete set null,
  job_role text not null,
  created_at timestamptz not null default now()
);

create table if not exists onboarding_plan_tasks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references onboarding_plans (id) on delete cascade,
  position int not null,
  title text not null,
  owner text not null,
  due_offset_days int not null
);
