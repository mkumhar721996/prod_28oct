-- More alert kinds written by the worker. Only widens the kind check (a superset of the old one) and
-- adds nullable columns, so existing money_received rows stay valid. Safe to re-run.
alter table alerts drop constraint if exists alerts_kind_check;
alter table alerts add constraint alerts_kind_check check (
  kind in ('money_received', 'transfer_sent', 'account_frozen', 'account_unfrozen', 'identity_verification_result')
);

-- transfer_sent: who the money went to (amount_minor and currency are reused).
alter table alerts add column if not exists recipient_name text;

-- identity_verification_result: the outcome.
alter table alerts add column if not exists verification_result text
  check (verification_result in ('approved', 'rejected'));
