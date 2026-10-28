// Needs PostgreSQL: set DATABASE_URL to a throwaway database with migrations/*.sql applied.
import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';

const ana = { email: 'ana@example.com', password: 'play-2026' };
const ben = { email: 'ben@example.com', password: 'ben-pass-1' };

describe('Player accounts (e2e)', () => {
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
    await pool.query('truncate sessions, wallets, players cascade');
  });

  afterAll(async () => {
    await pool.end();
    await app.close();
  });

  it('AC1: register signs the visitor in', async () => {
    const agent = request.agent(server());
    const res = await agent.post('/session/register').send(ana);
    expect(res.status).toBe(201);
    expect((await agent.get('/session')).status).toBe(200);
  });

  it('AC2: sign-in with the right credentials sets an HttpOnly session cookie', async () => {
    await request(server()).post('/session/register').send(ana);
    const res = await request(server()).post('/session/sign-in').send(ana);
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie'][0]).toMatch(/session=.*HttpOnly/);
  });

  it('AC3: sign-out ends the session', async () => {
    const agent = request.agent(server());
    await agent.post('/session/register').send(ana);
    await agent.post('/session/sign-out').expect(204);
    expect((await agent.get('/session')).status).toBe(401);
  });

  it('AC4: a new account holds 1,000 credits', async () => {
    const agent = request.agent(server());
    await agent.post('/session/register').send(ana);
    expect((await agent.get('/wallet')).body).toEqual({ balanceCredits: 1000 });
  });

  it('AC5: signing out and back in grants nothing more', async () => {
    const agent = request.agent(server());
    await agent.post('/session/register').send(ana);
    await agent.post('/session/sign-out');
    await agent.post('/session/sign-in').send(ana);
    expect((await agent.get('/wallet')).body.balanceCredits).toBe(1000);
    const { rows } = await pool.query('select count(*)::int as n from wallets');
    expect(rows[0].n).toBe(1);
  });

  it('AC6: each player sees only their own balance', async () => {
    const anaAgent = request.agent(server());
    const benAgent = request.agent(server());
    await anaAgent.post('/session/register').send(ana);
    await benAgent.post('/session/register').send(ben);
    await pool.query(
      'update wallets set balance_credits = 640 where player_id = (select id from players where email = $1)',
      [ben.email],
    );
    expect((await anaAgent.get('/wallet')).body.balanceCredits).toBe(1000);
    expect((await benAgent.get('/wallet')).body.balanceCredits).toBe(640);
  });

  it('AC7: a duplicate email is refused, whatever its case or spacing', async () => {
    await request(server()).post('/session/register').send(ana).expect(201);
    const res = await request(server())
      .post('/session/register')
      .send({ ...ana, email: ' ANA@example.com ' });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already exists/i);
  });

  it('AC8: a wrong password and an unknown email get the same answer', async () => {
    await request(server()).post('/session/register').send(ana);
    for (const body of [
      { email: ana.email, password: 'nope-nope' },
      { email: 'nobody@example.com', password: 'nope-nope' },
    ]) {
      const res = await request(server()).post('/session/sign-in').send(body);
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Email or password incorrect');
    }
  });

  it('AC9: the right password after a wrong one signs in', async () => {
    await request(server()).post('/session/register').send(ana);
    await request(server())
      .post('/session/sign-in')
      .send({ ...ana, password: 'wrong-wrong' })
      .expect(401);
    await request(server()).post('/session/sign-in').send(ana).expect(200);
  });

  it('AC10: a signed-out wallet request is refused', async () => {
    expect((await request(server()).get('/wallet')).status).toBe(401);
  });
});
