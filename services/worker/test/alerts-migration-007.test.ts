import { readFileSync } from 'fs';
import { join } from 'path';

const read = (f: string) => readFileSync(join(__dirname, '../../api/migrations', f), 'utf8');

describe('migration 007', () => {
  const sql = read('007_alerts_more_kinds.sql');

  it('allows all five kinds', () => {
    for (const k of ['money_received', 'transfer_sent', 'account_frozen', 'account_unfrozen', 'identity_verification_result']) {
      expect(sql).toContain(`'${k}'`);
    }
  });

  it('keeps the unique (kind, event_id) index from 006', () => {
    expect(read('006_alerts.sql')).toMatch(/unique index if not exists alerts_event_id_idx on alerts \(kind, event_id\)/);
  });

  it('does not delete or rewrite existing rows', () => {
    expect(sql).not.toMatch(/\bdelete\b|\bupdate\b|\btruncate\b|drop table|drop column/i);
  });
});
