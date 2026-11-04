// Needs PostgreSQL: set DATABASE_URL to a throwaway database with migrations/*.sql applied.
import 'reflect-metadata';
import { readFileSync } from 'fs';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { StaffService } from '../src/staff/staff.service';

const staffA = { email: 'a.staff@bank.example', password: 'Staff-pass-A1' };
const staffB = { email: 'b.staff@bank.example', password: 'Staff-pass-B1' };
const customer = { email: 'jo.carter@example.com', password: 'Cust-pass1' };

describe('Freeze and unfreeze an account (e2e)', () => {
  let app: INestApplication;
  let pool: Pool;
  let staffACookie: string[];
  let staffBCookie: string[];
  let customerCookie: string[];
  let playerId: string;
  let openA: string;
  let openB: string;
  let other: string;
  const server = () => app.getHttpServer();

  const newAccount = async (balance: number, owner = playerId) =>
    (
      await pool.query('insert into accounts (player_id, balance_credits) values ($1, $2) returning id', [
        owner,
        balance,
      ])
    ).rows[0].id as string;
  const balanceOf = async (id: string) =>
    Number((await pool.query('select balance_credits from accounts where id = $1', [id])).rows[0].balance_credits);
  const isFrozen = async (id: string) =>
    (await pool.query('select frozen_at from accounts where id = $1', [id])).rows[0].frozen_at !== null;
  const events = async (id: string, action: string) =>
    (await pool.query('select count(*)::int as n from account_freeze_events where account_id = $1 and action = $2', [id, action])).rows[0].n;
  const freeze = (id: string, body: object, cookie = staffACookie) =>
    request(server()).post(`/staff/accounts/${id}/freeze`).set('Cookie', cookie).send(body);
  const transfer = (body: object) => request(server()).post('/transfers').set('Cookie', customerCookie).send(body);

  const signIn = async (path: string, creds: object) =>
    (await request(server()).post(path).send(creds)).headers['set-cookie'] as unknown as string[];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  });

  beforeEach(async () => {
    await pool.query(
      'truncate account_freeze_events, accounts, staff_sessions, staff_accounts, sessions, wallets, players cascade',
    );
    await app.get(StaffService).create(staffA.email, staffA.password);
    await app.get(StaffService).create(staffB.email, staffB.password);
    staffACookie = await signIn('/staff/session/sign-in', staffA);
    staffBCookie = await signIn('/staff/session/sign-in', staffB);
    const registered = await request(server()).post('/session/register').send(customer);
    customerCookie = registered.headers['set-cookie'] as unknown as string[];
    playerId = (await pool.query('select id from players where email = $1', [customer.email])).rows[0].id;
    await pool.query('delete from accounts');
    openA = await newAccount(100);
    openB = await newAccount(0);
    other = await newAccount(50);
  });

  afterAll(async () => {
    await pool.end();
    await app.close();
  });

  it('AC1: a blank reason is refused and the account is not frozen', async () => {
    const res = await freeze(openA, { reason: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('reason_required');
    expect(await isFrozen(openA)).toBe(false);
  });

  it('AC2: a reason freezes that one account only', async () => {
    const res = await freeze(openA, { reason: 'Suspected card fraud' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ frozen: true, freezeReason: 'Suspected card fraud' });
    expect(await events(openA, 'freeze')).toBe(1);
    expect(await isFrozen(other)).toBe(false);
  });

  it('AC3: any staff member unfreezes', async () => {
    await freeze(openA, { reason: 'Fraud' }, staffACookie);
    const res = await request(server()).post(`/staff/accounts/${openA}/unfreeze`).set('Cookie', staffBCookie);
    expect(res.status).toBe(201);
    expect(res.body.frozen).toBe(false);
    expect(await events(openA, 'unfreeze')).toBe(1);
  });

  it('AC4: a transfer from a frozen account is refused', async () => {
    await freeze(openA, { reason: 'Fraud' });
    const res = await transfer({ fromId: openA, toId: openB, amount: 10 });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('account_frozen');
    expect(await balanceOf(openA)).toBe(100);
  });

  it('AC5: a transfer to a frozen account is refused', async () => {
    await freeze(openB, { reason: 'Fraud' });
    const res = await transfer({ fromId: openA, toId: openB, amount: 10 });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('account_frozen');
    expect(await balanceOf(openA)).toBe(100);
  });

  it('a freeze racing a transfer never leaves balances half-moved', async () => {
    await Promise.all([transfer({ fromId: openA, toId: openB, amount: 10 }), freeze(openB, { reason: 'Fraud' })]);
    expect(await isFrozen(openB)).toBe(true);
    const a = await balanceOf(openA);
    const b = await balanceOf(openB);
    expect(a + b).toBe(100);
    expect([0, 10]).toContain(b);
  });

  it('AC6: a customer with a frozen account still signs in', async () => {
    await freeze(openA, { reason: 'Fraud' });
    const res = await request(server()).post('/session/sign-in').send(customer);
    expect(res.status).toBe(200);
  });

  it('AC7: a transfer between open accounts succeeds while another account is frozen', async () => {
    await freeze(other, { reason: 'Fraud' });
    const res = await transfer({ fromId: openA, toId: openB, amount: 10 });
    expect(res.status).toBe(201);
    expect(await balanceOf(openA)).toBe(90);
  });

  it('AC8: a signed-in customer cannot freeze, unfreeze or search', async () => {
    const res = await freeze(openA, { reason: 'x' }, customerCookie);
    expect(res.status).toBe(401);
    expect(await isFrozen(openA)).toBe(false);
    expect((await request(server()).post(`/staff/accounts/${openA}/unfreeze`).set('Cookie', customerCookie)).status).toBe(401);
    expect((await request(server()).get('/staff/accounts').set('Cookie', customerCookie)).status).toBe(401);
  });

  it('migration 006 is re-runnable and backfills an account per player', async () => {
    await pool.query('delete from accounts');
    const sql = readFileSync(join(__dirname, '..', 'migrations', '006_accounts_freeze.sql'), 'utf8');
    await pool.query(sql);
    await pool.query(sql);
    const { rows } = await pool.query('select frozen_at from accounts where player_id = $1', [playerId]);
    expect(rows).toHaveLength(1);
    expect(rows[0].frozen_at).toBeNull();
  });
});
