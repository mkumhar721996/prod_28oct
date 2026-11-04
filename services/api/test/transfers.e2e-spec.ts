// Needs PostgreSQL: set DATABASE_URL to a throwaway database with migrations/*.sql applied.
import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';

const ana = { email: 'ana@example.com', password: 'play-2026' };

describe('Transfers (e2e)', () => {
  let app: INestApplication;
  let pool: Pool;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  });

  beforeEach(async () => {
    await pool.query(
      'truncate audit_records, transfers, accounts, sessions, wallet_entries, wallets, players cascade',
    );
  });

  afterAll(async () => {
    await pool.end();
    await app.close();
  });

  async function signedIn(checking: number, savings: number) {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/session/register').send(ana).expect(201);
    await pool.query("update accounts set balance = $1 where kind = 'checking'", [checking]);
    await pool.query("update accounts set balance = $1 where kind = 'savings'", [savings]);
    const { body } = await agent.get('/accounts').expect(200);
    const id = (kind: string) => body.find((a: { kind: string }) => a.kind === kind).id as string;
    return { agent, checking: id('checking'), savings: id('savings') };
  }

  it('is 401 when signed out', async () => {
    await request(app.getHttpServer()).get('/accounts').expect(401);
    await request(app.getHttpServer()).post('/transfers').send({}).expect(401);
  });

  it('AC3/AC4/AC10/AC11: moves money once, even when the confirmation is sent twice', async () => {
    const { agent, checking, savings } = await signedIn(200, 100);
    const body = { fromAccountId: checking, toAccountId: savings, amount: 50, idempotencyKey: 'same' };
    await agent.post('/transfers').send(body).expect(200);
    const second = await agent.post('/transfers').send(body).expect(200);
    expect(second.body.replayed).toBe(true);
    const { body: accounts } = await agent.get('/accounts').expect(200);
    expect(accounts.map((a: { balance: number }) => a.balance)).toEqual([150, 150]);
    expect((await pool.query('select 1 from audit_records')).rowCount).toBe(1);
  });

  it('AC5: a low balance is a 409 "Transfer not made." and moves nothing', async () => {
    const { agent, checking, savings } = await signedIn(100, 100);
    const res = await agent
      .post('/transfers')
      .send({ fromAccountId: checking, toAccountId: savings, amount: 150, idempotencyKey: 'k' })
      .expect(409);
    expect(res.body.message).toMatch(/^Transfer not made\./);
    const { body: accounts } = await agent.get('/accounts').expect(200);
    expect(accounts.map((a: { balance: number }) => a.balance)).toEqual([100, 100]);
  });

  it('concurrent transfers never overdraw', async () => {
    const { agent, checking, savings } = await signedIn(100, 0);
    const results = await Promise.all(
      [1, 2, 3, 4, 5].map((n) =>
        agent
          .post('/transfers')
          .send({ fromAccountId: checking, toAccountId: savings, amount: 50, idempotencyKey: `k${n}` }),
      ),
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(2);
    const { rows } = await pool.query("select balance from accounts where kind = 'checking'");
    expect(Number(rows[0].balance)).toBe(0);
  });
});
