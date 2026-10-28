// Needs PostgreSQL: set DATABASE_URL to a throwaway database with migrations/*.sql applied.
import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { WalletService } from '../src/wallet/wallet.service';

const ana = { email: 'ana@example.com', password: 'play-2026' };
const ben = { email: 'ben@example.com', password: 'ben-pass-1' };
const NOW = new Date('2026-10-28T12:00:00Z');
const daysBefore = (d: Date, n: number) => new Date(d.getTime() - n * 86_400_000);

describe('Wallet ledger (e2e)', () => {
  let app: INestApplication;
  let pool: Pool;
  let service: WalletService;
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    service = app.get(WalletService);
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  });

  beforeEach(async () => {
    await pool.query('truncate sessions, wallet_entries, wallets, players cascade');
  });

  afterAll(async () => {
    await pool.end();
    await app.close();
  });

  async function register(creds = ana) {
    const agent = request.agent(server());
    await agent.post('/session/register').send(creds).expect(201);
    return { agent };
  }
  async function playerId(email: string) {
    return (await pool.query('select id from players where email = $1', [email])).rows[0].id as string;
  }
  async function seed(id: string, balance: number) {
    await pool.query('update wallets set balance_credits = $2 where player_id = $1', [id, balance]);
  }
  async function entryCount(id: string, kind: string) {
    const { rows } = await pool.query(
      'select count(*)::int as n from wallet_entries where player_id = $1 and kind = $2',
      [id, kind],
    );
    return rows[0].n as number;
  }
  async function insertEntry(id: string, kind: string, createdAt: Date) {
    await pool.query(
      'insert into wallet_entries (player_id, kind, amount_credits, balance_after_credits, created_at) values ($1, $2, 5, 5, $3)',
      [id, kind, createdAt],
    );
  }

  it('AC1/AC2: a bet debits and a win credits, each with a ledger row', async () => {
    await register();
    const id = await playerId(ana.email);
    await seed(id, 500);
    expect(await service.placeBet(id, 100)).toEqual({ ok: true, balanceCredits: 400 });
    expect(await service.balanceFor(id)).toBe(400);
    expect(await service.recordWin(id, 250)).toEqual({ ok: true, balanceCredits: 650 });
    const { rows } = await pool.query(
      "select balance_after_credits from wallet_entries where player_id = $1 and kind = 'win'",
      [id],
    );
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].balance_after_credits)).toBe(650);
  });

  it('AC3: two simultaneous bets of 6 on 10 accept only one', async () => {
    await register();
    const id = await playerId(ana.email);
    await seed(id, 10);
    const results = await Promise.all([service.placeBet(id, 6), service.placeBet(id, 6)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await service.balanceFor(id)).toBe(4);
    expect(await entryCount(id, 'bet')).toBe(1);
  });

  it('AC4/AC5/AC7/AC8/AC9: the strict balance > bet rule', async () => {
    await register();
    const id = await playerId(ana.email);
    await seed(id, 10);
    expect(await service.placeBet(id, 9)).toEqual({ ok: true, balanceCredits: 1 });
    await seed(id, 10);
    expect(await service.placeBet(id, 10)).toEqual({ ok: false, reason: 'insufficient_balance' });
    expect(await service.balanceFor(id)).toBe(10);
    await seed(id, 2);
    expect(await service.placeBet(id, 1)).toEqual({ ok: true, balanceCredits: 1 });
    for (const start of [1, 0]) {
      await seed(id, start);
      expect(await service.placeBet(id, 1)).toEqual({ ok: false, reason: 'insufficient_balance' });
      expect(await service.balanceFor(id)).toBe(start);
    }
  });

  it('AC6/16/17: invalid amounts leave the balance unchanged', async () => {
    await register();
    const id = await playerId(ana.email);
    await seed(id, 10);
    for (const bad of [0, -1, 1.5]) {
      expect(await service.placeBet(id, bad)).toEqual({ ok: false, reason: 'invalid_amount' });
    }
    expect(await service.balanceFor(id)).toBe(10);
  });

  it('AC10: top-up from 1 credit, refused from 2, over HTTP and the service', async () => {
    const { agent } = await register();
    const id = await playerId(ana.email);
    await seed(id, 2);
    await agent.post('/wallet/top-up').expect(409);
    await seed(id, 1);
    const res = await agent.post('/wallet/top-up').expect(200);
    expect(res.body).toEqual({ balanceCredits: 501, grantedCredits: 500 });
    expect(await service.claimTopUp(id)).toEqual({ ok: false, reason: 'balance_not_low' });
    expect((await agent.get('/wallet')).body).toEqual({
      balanceCredits: 501,
      topUp: { eligible: false, credits: 500 },
    });
    await request(server()).post('/wallet/top-up').expect(401);
  });

  it('AC11 and the welcome bonus: every entry is listed with time and balance', async () => {
    const { agent } = await register();
    const id = await playerId(ana.email);
    expect((await agent.get('/wallet/history')).body.entries).toMatchObject([
      { kind: 'grant', amountCredits: 1000, balanceCredits: 1000 },
    ]);
    await seed(id, 10);
    await service.placeBet(id, 9);
    await service.recordWin(id, 5);
    await seed(id, 1);
    await service.claimTopUp(id);
    const h = await service.historyFor(id, { page: 1, range: 'recent' });
    expect(h.entries.map((e) => e.kind)).toEqual(['topup', 'win', 'bet', 'grant']);
    expect(h.entries[0]).toMatchObject({
      balanceCredits: expect.any(Number),
      createdAt: expect.stringMatching(/Z$/),
    });
  });

  it('AC12/AC13: pages of 10, and the oldest page lists the first entry', async () => {
    await register();
    const id = await playerId(ana.email);
    for (let i = 1; i <= 24; i++) await insertEntry(id, 'bet', daysBefore(NOW, 0.5 + i * 1.1));
    await pool.query("update wallet_entries set created_at = $2 where player_id = $1 and kind = 'grant'", [
      id,
      daysBefore(NOW, 29),
    ]);
    const first = await service.historyFor(id, { page: 1, range: 'recent' }, NOW);
    expect(first.entries).toHaveLength(10);
    expect(first.pageCount).toBe(3);
    const last = await service.historyFor(id, { page: 3, range: 'recent' }, NOW);
    expect(last.entries.at(-1)).toMatchObject({ kind: 'grant' });
  });

  it('AC14/AC15: 30 days is listed, 31 days is hidden but kept', async () => {
    await register();
    const id = await playerId(ana.email);
    await pool.query("delete from wallet_entries where kind = 'grant' and player_id = $1", [id]);
    await insertEntry(id, 'bet', daysBefore(NOW, 31));
    expect((await service.historyFor(id, { page: 1, range: 'recent' }, NOW)).entries).toHaveLength(0);
    expect((await service.historyFor(id, { page: 1, range: 'all' }, NOW)).entries).toHaveLength(1);
    await insertEntry(id, 'bet', daysBefore(NOW, 30));
    expect((await service.historyFor(id, { page: 1, range: 'recent' }, NOW)).entries).toHaveLength(1);
  });

  it('history is private, needs a session, and tolerates bad query values', async () => {
    const { agent } = await register();
    await register(ben);
    await request(server()).get('/wallet/history').expect(401);
    const res = await agent.get('/wallet/history?page=abc&range=bogus&x=1');
    expect(res.body).toMatchObject({ page: 1, range: 'recent', total: 1 });
    const all = await agent.get('/wallet/history?range=all');
    expect(all.body.total).toBe(1);
  });

  it('migration backfill: an existing player gets one grant, once', async () => {
    await register();
    const id = await playerId(ana.email);
    await pool.query('delete from wallet_entries where player_id = $1', [id]);
    const fs = await import('fs');
    const path = await import('path');
    const sql = fs.readFileSync(path.join(__dirname, '../migrations/002_wallet_entries.sql'), 'utf8');
    await pool.query(sql);
    await pool.query(sql);
    expect(await entryCount(id, 'grant')).toBe(1);
    expect(await service.placeBet(id, 100)).toEqual({ ok: true, balanceCredits: 900 });
  });
});
