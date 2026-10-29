// Needs PostgreSQL: set DATABASE_URL to a throwaway database with migrations/*.sql applied.
import 'reflect-metadata';
import { connect, AddressInfo } from 'node:net';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
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
    const { rows } = await pool.query('select id from players where email = $1', [ana.email]);
    return { agent, id: rows[0].id as string };
  }
  const count = async (table: string, id: string) =>
    (await pool.query(`select count(*)::int as n from ${table} where player_id = $1`, [id])).rows[0].n as number;
  const tiers = async () => {
    const { rows } = await pool.query('select mini_cents, minor_cents, major_cents, grand_cents from jackpot_pool');
    return Object.values(rows[0]).map(Number);
  };

  it('requires a session', async () => {
    await request(server()).get('/game').expect(401);
    await request(server()).post('/game/spin').send({ bet: 100 }).expect(401);
  });

  it('AC5: the balance is the old balance minus the bet plus any win, in the wallet too', async () => {
    const { agent } = await register();
    const res = await agent.post('/game/spin').send({ bet: 100 }).expect(200);
    expect(res.body.balanceCredits).toBe(1000 - 100 + res.body.winCredits);
    expect((await agent.get('/wallet').expect(200)).body.balanceCredits).toBe(res.body.balanceCredits);
  });

  it('AC6/AC7: a bet of 100 adds 5 credits split 2, 1.5, 1 and 0.5', async () => {
    const { agent } = await register();
    const before = (await agent.get('/game').expect(200)).body.jackpot;
    await agent.post('/game/spin').send({ bet: 100 }).expect(200);
    expect(await tiers()).toEqual([200, 150, 100, 50]);
    const after = (await agent.get('/game').expect(200)).body.jackpot;
    expect(after.totalCents - before.totalCents).toBe(500);
  });

  it('AC11: a bet of 25 adds 50, 38, 25 and 13 cents', async () => {
    const { agent } = await register();
    await agent.post('/game/spin').send({ bet: 25 }).expect(200);
    expect(await tiers()).toEqual([50, 38, 25, 13]);
  });

  it('AC8: a spin whose response is discarded is still settled', async () => {
    const { agent, id } = await register();
    const cookie = (
      await request(server()).post('/session/sign-in').send(ana).expect(200)
    ).headers['set-cookie'][0].split(';')[0];
    await app.listen(0);
    const { port } = server().address() as AddressInfo;
    const body = JSON.stringify({ bet: 100 });
    // The request is fully written before the connection is destroyed, so the server always receives it.
    await new Promise<void>((resolve, reject) => {
      const socket = connect(port, '127.0.0.1', () => {
        socket.write(
          `POST /game/spin HTTP/1.1\r\nHost: localhost\r\nCookie: ${cookie}\r\nContent-Type: application/json\r\n` +
            `Content-Length: ${Buffer.byteLength(body)}\r\nConnection: close\r\n\r\n${body}`,
          (err) => {
            socket.destroy();
            err ? reject(err) : resolve();
          },
        );
      });
      socket.on('error', () => undefined);
    });
    for (let i = 0; i < 50 && (await count('spins', id)) === 0; i++) {
      await new Promise((r) => setTimeout(r, 100));
    }
    const state = (await agent.get('/game').expect(200)).body;
    expect(await count('spins', id)).toBe(1);
    const { rows } = await pool.query('select win_credits from spins where player_id = $1', [id]);
    expect(state.balanceCredits).toBe(1000 - 100 + Number(rows[0].win_credits));
    expect(await count('wallet_entries', id)).toBeGreaterThanOrEqual(3);
  });

  it('AC10: 409 when the balance does not cover the bet, and nothing is written', async () => {
    const { agent, id } = await register();
    await pool.query('update wallets set balance_credits = 100 where player_id = $1', [id]);
    const entries = await count('wallet_entries', id);
    const res = await agent.post('/game/spin').send({ bet: 250 }).expect(409);
    expect(res.body.message).toMatch(/does not cover a bet of 250/);
    expect((await agent.get('/wallet')).body.balanceCredits).toBe(100);
    expect(await count('wallet_entries', id)).toBe(entries);
    expect(await count('spins', id)).toBe(0);
    expect(await tiers()).toEqual([0, 0, 0, 0]);
  });

  it('refuses a bet that is not offered', async () => {
    const { agent } = await register();
    await agent.post('/game/spin').send({ bet: 7 }).expect(400);
    await agent.post('/game/spin').send({}).expect(400);
  });

  it('keeps an existing player ledger readable after migration 004', async () => {
    const { agent } = await register();
    const history = (await agent.get('/wallet/history').expect(200)).body;
    expect(history.entries[0]).toMatchObject({ kind: 'grant', amountCredits: 1000 });
  });
});
