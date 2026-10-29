-- History is listed newest first by id (assigned at insert, after the wallet row lock, so it follows the balance chain).
create index if not exists wallet_entries_player_id_idx
  on wallet_entries (player_id, id desc);
