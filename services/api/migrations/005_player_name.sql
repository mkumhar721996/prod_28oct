-- The name limit (50) must match MAX_NAME_LENGTH in players.constants.ts and apps/web/src/lib/credentials.ts.

-- Display name chosen at sign-up. Nullable so players created before this column existed stay valid; names are not unique.
alter table players add column if not exists name text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'players_name_length') then
    alter table players
      add constraint players_name_length check (name is null or char_length(name) between 1 and 50);
  end if;
end $$;
