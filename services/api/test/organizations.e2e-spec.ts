// Needs PostgreSQL: set DATABASE_URL to a throwaway database with migrations/*.sql applied.
import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { AccountsService } from '../src/accounts/accounts.service';
import { AppModule } from '../src/app.module';

const PASSWORD = 'Welcome-2026';
const roles = ['super_admin', 'staff', 'fundraising_consultant'] as const;
const emailFor = (role: string) => `${role}@org.example`;

describe('Sign-in, accounts and organizations (e2e)', () => {
  let app: INestApplication;
  let pool: Pool;
  let orgId: string;
  const server = () => app.getHttpServer();

  async function agentFor(role: (typeof roles)[number]) {
    const agent = request.agent(server());
    const res = await agent
      .post('/auth/session/sign-in')
      .send({ email: emailFor(role), password: PASSWORD });
    expect(res.status).toBe(200);
    return agent;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  });

  beforeEach(async () => {
    await pool.query('truncate app_sessions, app_users, organizations cascade');
    for (const role of roles) await app.get(AccountsService).create(emailFor(role), PASSWORD, role);
    const { rows } = await pool.query(
      "insert into organizations (name, address) values ('Acme Giving', '1 High St') returning id",
    );
    orgId = rows[0].id;
  });

  afterAll(async () => {
    await pool.end();
    await app.close();
  });

  it('migration 007 applies twice', async () => {
    const sql = (await import('node:fs')).readFileSync(
      `${__dirname}/../migrations/007_app_users_organizations.sql`,
      'utf8',
    );
    await pool.query(sql);
    await pool.query(sql);
  });

  it('AC9: the role check constraint refuses an unknown role', async () => {
    await expect(
      pool.query("insert into app_users (email, password_hash, role) values ('a@b.co', 'x', 'owner')"),
    ).rejects.toThrow();
  });

  it('AC2: wrong password and unknown email get the same message and no cookie', async () => {
    for (const body of [
      { email: 'nobody@org.example', password: PASSWORD },
      { email: emailFor('staff'), password: 'wrong-pass-1' },
    ]) {
      const res = await request(server()).post('/auth/session/sign-in').send(body);
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Email or password is incorrect');
      expect(res.headers['set-cookie']).toBeUndefined();
    }
  });

  it.each(roles)('AC10: a %s signs in with the right credentials', async (role) => {
    const agent = await agentFor(role);
    expect((await agent.get('/auth/session')).body).toEqual({ email: emailFor(role), role });
  });

  it('AC3: signed-out requests get no organization data', async () => {
    for (const path of ['/organizations', `/organizations/${orgId}`]) {
      const res = await request(server()).get(path);
      expect(res.status).toBe(401);
      expect(JSON.stringify(res.body)).not.toContain('Acme');
    }
    expect((await request(server()).patch(`/organizations/${orgId}`).send({ name: 'x' })).status).toBe(401);
    expect((await request(server()).delete(`/organizations/${orgId}`)).status).toBe(401);
  });

  it.each(['staff', 'fundraising_consultant'] as const)('AC4-AC6/AC8: %s reads and edits, cannot delete or create', async (role) => {
    const agent = await agentFor(role);
    expect((await agent.get(`/organizations/${orgId}`)).body).toMatchObject({ name: 'Acme Giving', address: '1 High St' });
    expect((await agent.patch(`/organizations/${orgId}`).send({ name: 'Acme Giving Ltd', address: '2 Low Rd' })).status).toBe(200);
    expect((await agent.get(`/organizations/${orgId}`)).body.name).toBe('Acme Giving Ltd');
    expect((await agent.delete(`/organizations/${orgId}`)).status).toBe(403);
    expect((await agent.get(`/organizations/${orgId}`)).status).toBe(200);
    const before = await pool.query('select count(*) from app_users');
    const res = await agent.post('/accounts').send({ email: 'n@org.example', password: PASSWORD, role: 'staff' });
    expect(res.status).toBe(403);
    expect(await pool.query('select count(*) from app_users')).toMatchObject({ rows: before.rows });
  });

  it('AC7: a super_admin deletes an organization', async () => {
    const agent = await agentFor('super_admin');
    expect((await agent.delete(`/organizations/${orgId}`)).status).toBe(204);
    expect((await agent.get(`/organizations/${orgId}`)).status).toBe(404);
  });

  it.each(roles)('AC1/AC9: a super_admin creates a %s account with exactly that role', async (role) => {
    const agent = await agentFor('super_admin');
    const email = `new-${role}@org.example`;
    const res = await agent.post('/accounts').send({ email, password: PASSWORD, role });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: expect.any(String), email, role });
    const { rows } = await pool.query('select role from app_users where email = $1', [email]);
    expect(rows).toEqual([{ role }]);
  });

  it('AC11/AC12: an expired session is refused and shows only saved details after sign-in', async () => {
    const agent = await agentFor('staff');
    await pool.query("update app_sessions set last_activity_at = now() - interval '31 minutes'");
    const res = await agent.get('/auth/session');
    expect(res.status).toBe(401);
    expect(res.body.reason).toBe('expired');
    const second = await agentFor('staff');
    expect((await second.get(`/organizations/${orgId}`)).body.name).toBe('Acme Giving');
  });

  it('AC13: the seeded super-admin signs in and a second seed is a no-op', async () => {
    await pool.query('truncate app_sessions, app_users cascade');
    const accounts = app.get(AccountsService);
    await accounts.ensureSuperAdmin('root@org.example', 'Seeded-pass-1');
    const first = await pool.query('select password_hash from app_users');
    await accounts.ensureSuperAdmin('root@org.example', 'Seeded-pass-1');
    const after = await pool.query('select password_hash, role from app_users');
    expect(after.rows).toHaveLength(1);
    expect(after.rows[0].password_hash).toBe(first.rows[0].password_hash);
    const agent = request.agent(server());
    expect((await agent.post('/auth/session/sign-in').send({ email: 'root@org.example', password: 'Seeded-pass-1' })).status).toBe(200);
    expect((await agent.get('/auth/session')).body.role).toBe('super_admin');
  });
});
