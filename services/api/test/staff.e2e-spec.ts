// Needs PostgreSQL: set DATABASE_URL to a throwaway database with migrations/*.sql applied.
import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { StaffService } from '../src/staff/staff.service';

const staff = { email: 'new.hire@bank.example', password: 'Welcome-2026' };
const customer = { email: 'jo.carter@example.com', password: 'Cust-pass1' };

describe('Staff sign-in (e2e)', () => {
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
    await pool.query('truncate staff_sessions, staff_accounts, sessions, wallets, players cascade');
    await app.get(StaffService).create(staff.email, staff.password);
  });

  afterAll(async () => {
    await pool.end();
    await app.close();
  });

  it('AC1/AC7: an administrator-created staff member signs in and opens the tools', async () => {
    const agent = request.agent(server());
    const res = await agent.post('/staff/session/sign-in').send(staff);
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie'][0]).toMatch(/staff_session=.*HttpOnly.*SameSite=Lax/);
    expect((await agent.get('/staff/session')).body).toEqual({ email: staff.email });
  });

  it('AC2/AC3: a customer cannot sign in on the staff sign-in or reach the tools', async () => {
    const agent = request.agent(server());
    await agent.post('/session/register').send(customer);
    expect((await agent.get('/staff/session')).status).toBe(401);
    expect((await request(server()).post('/staff/session/sign-in').send(customer)).status).toBe(401);
  });

  it('AC4: a signed-out visitor is refused', async () => {
    expect((await request(server()).get('/staff/session')).status).toBe(401);
  });

  it('AC5: a wrong password is refused', async () => {
    const res = await request(server())
      .post('/staff/session/sign-in')
      .send({ ...staff, password: 'wrong-pass-1' });
    expect(res.status).toBe(401);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('AC6: registering creates no account', async () => {
    const res = await request(server()).post('/staff/session/register').send(customer);
    expect(res.status).toBe(403);
    const { rows } = await pool.query('select count(*)::int as n from staff_accounts');
    expect(rows[0].n).toBe(1);
  });

  it('AC8: after sign-out the old cookie is refused', async () => {
    const agent = request.agent(server());
    const res = await agent.post('/staff/session/sign-in').send(staff);
    const cookie = res.headers['set-cookie'][0].split(';')[0];
    await agent.post('/staff/session/sign-out').expect(204);
    const old = await request(server()).get('/staff/session').set('Cookie', cookie);
    expect(old.status).toBe(401);
  });

  it('AC9/AC10: 14 minutes idle opens, 15 minutes idle is refused', async () => {
    const agent = request.agent(server());
    await agent.post('/staff/session/sign-in').send(staff);
    await pool.query("update staff_sessions set last_activity_at = now() - interval '14 minutes'");
    expect((await agent.get('/staff/session')).status).toBe(200);
    await pool.query("update staff_sessions set last_activity_at = now() - interval '15 minutes'");
    const res = await agent.get('/staff/session');
    expect(res.status).toBe(401);
    expect(res.body.reason).toBe('expired');
  });

  it('005_staff.sql can be applied twice', async () => {
    const { readFileSync } = await import('node:fs');
    const sql = readFileSync('migrations/005_staff.sql', 'utf8');
    await pool.query(sql);
    await pool.query(sql);
  });
});
