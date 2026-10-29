-- Jackpot activity on the ledger: the part of a bet that fed the jackpot, and the tier of a jackpot win.
-- Nullable with no default, so every existing row stays valid (null = no contribution / no tier).
alter table wallet_entries add column if not exists jackpot_contribution_credits numeric(18,6)
  check (jackpot_contribution_credits >= 0);
alter table wallet_entries add column if not exists jackpot_tier text
  check (jackpot_tier in ('Grand','Major','Minor','Mini'));

-- a tier only on a win, a contribution only on a bet
alter table wallet_entries drop constraint if exists wallet_entries_jackpot_kind_chk;
alter table wallet_entries add constraint wallet_entries_jackpot_kind_chk check (
  (jackpot_tier is null or kind = 'win') and (jackpot_contribution_credits is null or kind = 'bet'));
