-- The managers must match MANAGERS in hires.constants.ts (the manager is stored by name).

-- The minimum hire record plan creation needs: who, which role, when they start, and their manager.
-- Nothing creates hire rows yet (no endpoint, seed or nav link): a hire-creation story must add that.
-- Until then, rows are inserted by SQL and the pages are reached at /hires/{id}.
create table if not exists hires (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  job_role text not null,
  start_date date not null,
  manager_name text,
  created_at timestamptz not null default now()
);

-- A hire has one plan; the database refuses a second one, so concurrent "Create plan" presses cannot both win.
alter table onboarding_plans add column if not exists hire_id uuid references hires (id) on delete cascade;
create unique index if not exists onboarding_plans_hire_uniq on onboarding_plans (hire_id) where hire_id is not null;

-- Due dates are never stored: a plan task keeps its signed offset and the date is hires.start_date + offset.
-- Plan tasks still have NO foreign key to template tasks (see 004).
alter table onboarding_plan_tasks add column if not exists assignee text;
alter table onboarding_plan_tasks add column if not exists status text not null default 'not_started';
