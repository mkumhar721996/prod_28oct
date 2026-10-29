-- The reason limit (500) must match REASON_MAX in appointments.service.ts and apps/web/src/lib/appointments.ts.
-- A patient's booking of one 30-minute slot at a clinic. Clinics live in code, not in a table.
-- slot_start is the slot's start as a UTC instant; it is shown in the clinic's own time zone.
create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players (id),
  clinic_id text not null,
  slot_start timestamptz not null,
  reason text not null default '' check (char_length(reason) <= 500),
  created_at timestamptz not null default now()
);

-- A slot at a clinic is taken by one patient only.
create unique index if not exists appointments_clinic_slot_uniq
  on appointments (clinic_id, slot_start);

-- A patient holds one booking per time, at any clinic. Slots are all 30 minutes on a 30-minute grid,
-- so "overlapping" is "same start". Varying lengths would need an exclusion constraint on a range.
create unique index if not exists appointments_player_slot_uniq
  on appointments (player_id, slot_start);
