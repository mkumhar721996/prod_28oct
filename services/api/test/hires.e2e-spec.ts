import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { INVITE_PORT } from '../src/hires/invite.port';

const valid = { name: 'Ada', email: 'ada@example.com', role: 'Engineer', startDate: '2026-11-02' };

describe('POST /hires (e2e)', () => {
  let app: INestApplication;
  const invites = { send: jest.fn() };

  beforeEach(async () => {
    invites.send.mockReset();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(INVITE_PORT)
      .useValue(invites)
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const post = (body: object | string) => request(app.getHttpServer()).post('/hires').send(body);

  it('creates an invited hire and sends the invite', async () => {
    const res = await post(valid).expect(201);
    expect(res.body).toMatchObject({ ...valid, status: 'invited' });
    expect(invites.send).toHaveBeenCalledTimes(1);
  });

  it('answers 400 with every error at once for an empty body', async () => {
    const res = await post({}).expect(400);
    expect(Object.keys(res.body.errors).sort()).toEqual(['email', 'name', 'role', 'startDate']);
    expect(invites.send).not.toHaveBeenCalled();
  });

  it('answers 400 for bad payloads', async () => {
    await post({ ...valid, name: 123 }).expect(400);
    await post('not json').expect(400);
    await post({ ...valid, role: 'Wizard' }).expect(400);
  });

  it('answers 409 with the duplicate message for a second identical post', async () => {
    await post(valid).expect(201);
    const res = await post(valid).expect(409);
    expect(res.body).toMatchObject({
      errors: { email: 'A hire with this email already exists. Use a different email.' },
    });
    expect(invites.send).toHaveBeenCalledTimes(1);
  });

  it('gives exactly one 201 for concurrent duplicates', async () => {
    const codes = (await Promise.all([post(valid), post(valid)])).map((r) => r.status).sort();
    expect(codes).toEqual([201, 409]);
    expect(invites.send).toHaveBeenCalledTimes(1);
  });

  it('ignores unknown extra keys', async () => {
    const res = await post({ ...valid, status: 'complete', id: 'x' }).expect(201);
    expect(res.body.status).toBe('invited');
    expect(res.body.id).not.toBe('x');
  });

  it('answers 502 and keeps no hire when the invite fails', async () => {
    invites.send.mockRejectedValueOnce(new Error('queue down'));
    await post(valid).expect(502);
    await post(valid).expect(201);
  });

  it('lists hires', async () => {
    await post(valid).expect(201);
    const res = await request(app.getHttpServer()).get('/hires').expect(200);
    expect(res.body).toHaveLength(1);
  });
});
