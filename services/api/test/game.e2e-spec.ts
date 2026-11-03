// Needs PostgreSQL: set DATABASE_URL to a throwaway database with migrations/*.sql applied.
import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { connect, AddressInfo } from 'node:net';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';

const ana = { email: 'ana@example.com', password: 'play-2026' };

describe('Game (e2e)', () => {
  let app: INestApplication;
  let pool: Pool;
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  });

  beforeEach(async () => {
    await pool.query('truncate sessions, wallet_entries, wallets, players cascade');
    await pool.query('update jackpot_pool set mini_cents = 0, minor_cents = 0, major_cents = 0, grand_cents = 0');
  });

  afterAll(async () => {
    await pool.end();
    await app.close();
  });

  async function register() {
    const agent = request.agent(server());
    await agent.post('/session/register').send(ana).expect(201);
    const id = (await pool.query('select id from players where email = $1', [ana.email])).rows[0].id as string;
    return { agent, id };
  }
  const seed = (id: string, balance: number) =>
    pool.query('update wallets set balance_credits = $2 where player_id = $1', [id, balance]);
  async function count(table: 'spins' | 'wallet_entries', id: string) {
    const { rows } = await pool.query(`select count(*)::int as n from ${table} where player_id = $1`, [id]);
    return rows[0].n as number;
  }
  async function tiers() {
    const { rows } = await pool.query('select * from jackpot_pool where id = 1');
    return [rows[0].mini_cents, rows[0].minor_cents, rows[0].major_cents, rows[0].grand_cents].map(Number);
  }

  it('AC5/AC6/AC7: balance is 1000 - bet + win, and the pool moves by 5.00 split 2/1.5/1/0.5', async () => {
    const { agent, id } = await register();
    const before = (await agent.get('/game').expect(200)).body;
    const res = await agent.post('/game/spin').send({ bet: 100 }).expect(200);
    expect(res.body.balanceCredits).toBe(1000 - 100 + res.body.winCredits);
    expect((await agent.get('/wallet')).body.balanceCredits).toBe(res.body.balanceCredits);
    const after = (await agent.get('/game').expect(200)).body;
    expect(after.jackpot.totalCents - before.jackpot.totalCents).toBe(500);
    expect(await tiers()).toEqual([200, 150, 100, 50]);
    expect(await count('spins', id)).toBe(1);
  });

  it('AC11: a bet of 25 moves the tiers by 50, 38, 25 and 13 cents', async () => {
    const { agent } = await register();
    await agent.post('/game/spin').send({ bet: 25 }).expect(200);
    expect(await tiers()).toEqual([50, 38, 25, 13]);
  });

  it('AC10: a bet of 250 on a balance of 100 is a 409 and changes nothing', async () => {
    const { agent, id } = await register();
    await seed(id, 100);
    const entries = await count('wallet_entries', id);
    const res = await agent.post('/game/spin').send({ bet: 250 }).expect(409);
    expect(res.body.message).toMatch(/does not cover a bet of 250/);
    expect((await agent.get('/wallet')).body.balanceCredits).toBe(100);
    expect(await count('wallet_entries', id)).toBe(entries);
    expect(await count('spins', id)).toBe(0);
    expect(await tiers()).toEqual([0, 0, 0, 0]);
  });

  it('AC9: a balance equal to the bet may be wagered', async () => {
    const { agent, id } = await register();
    await seed(id, 100);
    const res = await agent.post('/game/spin').send({ bet: 100 }).expect(200);
    expect(res.body.balanceCredits).toBe(res.body.winCredits);
  });

  it('rejects an invalid bet with 400 and a signed-out visitor with 401', async () => {
    const { agent } = await register();
    for (const bet of [7, '100', undefined]) await agent.post('/game/spin').send({ bet }).expect(400);
    await request(server()).post('/game/spin').send({ bet: 100 }).expect(401);
    await request(server()).get('/game').expect(401);
  });

  it('AC8: a spin whose client drops mid-request is still settled in full', async () => {
    const { agent, id } = await register();
    const signIn = await request(server()).post('/session/sign-in').send(ana).expect(200);
    const cookie = (signIn.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
    await app.listen(0);
    const { port } = server().address() as AddressInfo;
    const body = JSON.stringify({ bet: 100 });
    await new Promise<void>((resolve, reject) => {
      const socket = connect(port, '127.0.0.1', () => {
        socket.write(
          `POST /game/spin HTTP/1.1\r\nHost: localhost\r\nCookie: ${cookie}\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(body)}\r\nConnection: close\r\n\r\n${body}`,
          (err) => {
            socket.destroy();
            if (err) reject(err);
            else resolve();
          },
        );
      });
      socket.on('error', () => undefined);
    });
    for (let i = 0; i < 50 && (await count('spins', id)) === 0; i++) {
      await new Promise((r) => setTimeout(r, 100));
    }
    const { rows } = await pool.query('select win_credits from spins where player_id = $1', [id]);
    expect(rows).toHaveLength(1);
    expect((await agent.get('/game')).body.balanceCredits).toBe(1000 - 100 + Number(rows[0].win_credits));
    expect(await count('wallet_entries', id)).toBeGreaterThanOrEqual(2);
  });

  it('data check: an existing wallet is read as before and re-running the migration is a no-op', async () => {
    const { agent } = await register();
    expect((await agent.get('/wallet')).body.balanceCredits).toBe(1000);
    const fs = await import('fs');
    const path = await import('path');
    const sql = fs.readFileSync(path.join(__dirname, '../migrations/005_jackpot_pool_and_spins.sql'), 'utf8');
    await pool.query(sql);
    expect((await pool.query('select count(*)::int as n from jackpot_pool')).rows[0].n).toBe(1);
    expect((await agent.get('/wallet/history')).body.entries).toHaveLength(1);
  });
});
