import { readFileSync } from 'fs';
import { join } from 'path';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ALREADY_DECIDED_MESSAGE } from './identity-verifications.constants';
import { IdentityVerificationsService } from './identity-verifications.service';

const row = (id: string, name: string, dob: string, idNumber: string, extra: Record<string, unknown> = {}) => ({
  id,
  player_id: 'player-1',
  full_name: name,
  date_of_birth: dob,
  id_number: idNumber,
  status: 'pending',
  rejection_reason: null,
  decided_by: null,
  decided_by_email: null,
  decided_at: null,
  submitted_at: new Date('2026-11-03T09:00:00Z'),
  ...extra,
});

type Responder = (sql: string, params?: unknown[]) => unknown[];

function setup(respond: Responder) {
  const calls: { sql: string; params?: unknown[] }[] = [];
  const query = jest.fn(async (sql: string, params?: unknown[]) => {
    calls.push({ sql, params });
    return { rows: respond(sql, params) };
  });
  const release = jest.fn();
  const pool = { query, connect: jest.fn(async () => ({ query, release })) };
  return { service: new IdentityVerificationsService({ pool } as unknown as DatabaseService), query, calls, release };
}

const approvedRow = row('7', 'Amara Newton', '1988-03-14', 'NX-402917', {
  status: 'approved',
  decided_by: 's1',
  decided_by_email: 'lee.park@example.com',
  decided_at: new Date('2026-11-03T15:42:00Z'),
});

describe('IdentityVerificationsService lists', () => {
  it('lists pending submissions with name, date of birth and ID number', async () => {
    const { service, query } = setup(() => [
      row('1', 'Amara Newton', '1988-03-14', 'NX-402917'),
      row('2', 'Tomasz Villanueva', '1979-07-02', 'PV-118305'),
    ]);
    const list = await service.listPending();
    expect(query.mock.calls[0][0]).toContain("where s.status = 'pending'");
    expect(list.map((s) => [s.fullName, s.dateOfBirth, s.idNumber])).toEqual([
      ['Amara Newton', '1988-03-14', 'NX-402917'],
      ['Tomasz Villanueva', '1979-07-02', 'PV-118305'],
    ]);
  });

  it('lists decided submissions with who decided and when', async () => {
    const { service, query } = setup(() => [approvedRow]);
    const decided = await service.listDecided();
    expect(query.mock.calls[0][0]).toContain("s.status in ('approved', 'rejected')");
    expect(decided[0]).toMatchObject({
      status: 'approved',
      decidedBy: 'lee.park@example.com',
      decidedAt: '2026-11-03T15:42:00.000Z',
    });
  });

  it('gets one submission with its decider, or null', async () => {
    const found = setup(() => [approvedRow]);
    await expect(found.service.get('7')).resolves.toMatchObject({ decidedBy: 'lee.park@example.com' });
    const none = setup(() => []);
    await expect(none.service.get('7')).resolves.toBeNull();
  });
});

describe('IdentityVerificationsService.decide', () => {
  const decideResponder =
    (opts: { updated: boolean; exists?: boolean }): Responder =>
    (sql) => {
      if (sql.startsWith('update identity_submissions')) return opts.updated ? [row('7', 'A', '1988-03-14', 'X')] : [];
      if (sql.startsWith('select 1')) return opts.exists === false ? [] : [{ '?column?': 1 }];
      return [];
    };

  it('approves with one conditional update and alerts the customer in the same transaction', async () => {
    const { service, calls } = setup(decideResponder({ updated: true }));
    await service.decide('7', 'staff-1', { kind: 'approve' });
    const update = calls.find((c) => c.sql.startsWith('update identity_submissions'))!;
    expect(update.sql).toContain("where id = $1 and status = 'pending'");
    expect(update.params).toEqual(['7', 'approved', null, 'staff-1']);
    const alert = calls.find((c) => c.sql.includes('insert into alerts'))!;
    expect(alert.params).toEqual(['player-1', 'identity_approved', 'identity:7:approved']);
    expect(calls.map((c) => c.sql)).toEqual(expect.arrayContaining(['begin', 'commit']));
  });

  it('rejects with the trimmed reason and an identity_rejected alert', async () => {
    const { service, calls } = setup(decideResponder({ updated: true }));
    await service.decide('7', 'staff-1', { kind: 'reject', reason: '  ID number does not match  ' });
    const update = calls.find((c) => c.sql.startsWith('update identity_submissions'))!;
    expect(update.params).toEqual(['7', 'rejected', 'ID number does not match', 'staff-1']);
    const alert = calls.find((c) => c.sql.includes('insert into alerts'))!;
    expect(alert.params).toEqual(['player-1', 'identity_rejected', 'identity:7:rejected']);
  });

  it.each(['', '   ', undefined, 5])('refuses a blank reason %p before any write', async (reason) => {
    const { service, query } = setup(decideResponder({ updated: true }));
    await expect(service.decide('7', 's', { kind: 'reject', reason })).rejects.toBeInstanceOf(BadRequestException);
    expect(query).not.toHaveBeenCalled();
  });

  it('refuses a second decision with 409 and writes nothing else', async () => {
    const { service, calls, release } = setup(decideResponder({ updated: false }));
    const err = await service.decide('7', 'staff-2', { kind: 'approve' }).catch((e) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect(err.message).toBe(ALREADY_DECIDED_MESSAGE);
    const sqls = calls.map((c) => c.sql);
    expect(sqls.some((q) => q.includes('insert into alerts'))).toBe(false);
    expect(sqls).toContain('rollback');
    expect(release).toHaveBeenCalled();
  });

  it('answers 404 for an id that does not exist', async () => {
    const { service } = setup(decideResponder({ updated: false, exists: false }));
    await expect(service.decide('7', 's', { kind: 'approve' })).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('IdentityVerificationsService customer side', () => {
  const details = { fullName: ' Amara Newton ', dateOfBirth: '1988-03-14', idNumber: ' NX-402917 ' };

  it('reports the latest submission with the rejection reason', async () => {
    const { service } = setup(() => [
      row('7', 'Amara Newton', '1988-03-14', 'NX-402917', {
        status: 'rejected',
        rejection_reason: 'Date of birth does not match the ID.',
      }),
    ]);
    await expect(service.latestFor('p1')).resolves.toMatchObject({
      status: 'rejected',
      rejectionReason: 'Date of birth does not match the ID.',
    });
  });

  it('reports approved for an approved customer', async () => {
    const { service } = setup(() => [approvedRow]);
    await expect(service.latestFor('p1')).resolves.toMatchObject({ status: 'approved' });
  });

  it('inserts a new pending row after a rejection', async () => {
    const { service, calls } = setup((sql) =>
      sql.startsWith('select') ? [row('7', 'A', '1988-03-14', 'X', { status: 'rejected', rejection_reason: 'r' })] : [row('8', 'Amara Newton', '1988-03-14', 'NX-402917')],
    );
    await service.submit('p1', details);
    const insert = calls.find((c) => c.sql.includes('insert into identity_submissions'))!;
    expect(insert.params).toEqual(['p1', 'Amara Newton', '1988-03-14', 'NX-402917']);
  });

  it.each(['pending', 'approved'])('refuses a submission when the latest is %s', async (status) => {
    const { service, calls } = setup(() => [row('7', 'A', '1988-03-14', 'X', { status })]);
    await expect(service.submit('p1', details)).rejects.toBeInstanceOf(ConflictException);
    expect(calls.some((c) => c.sql.includes('insert into'))).toBe(false);
  });

  it.each([
    { ...details, fullName: '  ' },
    { ...details, idNumber: '' },
    { ...details, dateOfBirth: 'not a date' },
    { ...details, dateOfBirth: '2031-01-01' },
    { ...details, dateOfBirth: '1988-02-31' },
  ])('refuses invalid details %#', async (bad) => {
    const { service, query } = setup(() => []);
    await expect(service.submit('p1', bad)).rejects.toBeInstanceOf(BadRequestException);
    expect(query).not.toHaveBeenCalled();
  });
});

describe('migration 007', () => {
  const sql = readFileSync(join(__dirname, '../../migrations/007_identity_verifications.sql'), 'utf8');

  it('creates the table idempotently with the decided-row checks', () => {
    expect(sql).toContain('create table if not exists identity_submissions');
    expect(sql).toContain("status = 'pending' or (decided_by is not null and decided_at is not null)");
  });

  it('allows one pending submission per customer and widens the alert kinds', () => {
    expect(sql).toContain('on identity_submissions (player_id) where status = \'pending\'');
    expect(sql).toContain("'identity_approved', 'identity_rejected'");
  });
});
