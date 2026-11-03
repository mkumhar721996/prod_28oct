import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { SessionService } from '../session/session.service';
import { OnboardingTemplatesController } from './onboarding-templates.controller';
import { OnboardingTemplatesService } from './onboarding-templates.service';
import { SessionGuard } from '../session/session.guard';
import { HrGuard } from '../session/hr.guard';

const HR = { id: 'p1', email: 'hr@example.com', accountRole: 'hr' };
const PLAYER = { id: 'p2', email: 'ana@example.com', accountRole: 'player' };
const goodTask = { title: 'Set up laptop', owner: 'it', dueOffsetDays: -3 };

async function setup(saveResult: unknown = { ok: true }) {
  const service = {
    roles: jest.fn(() => [{ role: 'software-engineer', name: 'Software engineer' }]),
    list: jest.fn(async () => [{ role: 'software-engineer', taskCount: 1, planCount: 0 }]),
    get: jest.fn(async (role: string) => (role === 'software-engineer' ? { role, tasks: [] } : null)),
    save: jest.fn(async () => saveResult),
  };
  // The cookie value picks who is signed in: `hr`, `player`, or nothing for signed out.
  const sessions = {
    resolve: jest.fn(async (cookie?: string) =>
      cookie === 'session=hr' ? HR : cookie === 'session=player' ? PLAYER : null,
    ),
  };
  const moduleRef = await Test.createTestingModule({
    controllers: [OnboardingTemplatesController],
    providers: [
      { provide: OnboardingTemplatesService, useValue: service },
      { provide: SessionService, useValue: sessions },
      SessionGuard,
      HrGuard,
    ],
  }).compile();
  const app: INestApplication = moduleRef.createNestApplication();
  await app.init();
  return { app, service };
}

const as = (who: 'hr' | 'player') => ['Cookie', `session=${who}`] as const;
const body = { role: 'software-engineer', tasks: [goodTask] };

describe('OnboardingTemplatesController', () => {
  let app: INestApplication;
  afterEach(() => app.close());

  it('GET without a session is 401', async () => {
    ({ app } = await setup());
    await request(app.getHttpServer()).get('/onboarding-templates').expect(401);
  });

  it('a non-HR user may read the list, the roles and a template (AC12)', async () => {
    ({ app } = await setup());
    const http = request(app.getHttpServer());
    await http.get('/onboarding-templates').set(...as('player')).expect(200);
    await http.get('/onboarding-templates/roles').set(...as('player')).expect(200);
    await http.get('/onboarding-templates/software-engineer').set(...as('player')).expect(200);
  });

  it('GET of a role with no template is 404', async () => {
    ({ app } = await setup());
    await request(app.getHttpServer())
      .get('/onboarding-templates/account-manager')
      .set(...as('hr'))
      .expect(404);
  });

  it('a non-HR POST and PUT are 403 and write nothing (AC12)', async () => {
    let service;
    ({ app, service } = await setup());
    const http = request(app.getHttpServer());
    await http.post('/onboarding-templates').set(...as('player')).send(body).expect(403);
    await http
      .put('/onboarding-templates/software-engineer')
      .set(...as('player'))
      .send({ tasks: [goodTask] })
      .expect(403);
    expect(service.save).not.toHaveBeenCalled();
  });

  it('a signed-out POST is 401', async () => {
    ({ app } = await setup());
    await request(app.getHttpServer()).post('/onboarding-templates').send(body).expect(401);
  });

  it('HR POST creates the template (AC1)', async () => {
    let service;
    ({ app, service } = await setup());
    await request(app.getHttpServer())
      .post('/onboarding-templates')
      .set(...as('hr'))
      .send(body)
      .expect(201);
    expect(service.save).toHaveBeenCalledWith('create', 'software-engineer', [goodTask]);
  });

  it('HR PUT edits the template of the URL role (AC2)', async () => {
    let service;
    ({ app, service } = await setup());
    await request(app.getHttpServer())
      .put('/onboarding-templates/software-engineer')
      .set(...as('hr'))
      .send({ tasks: [goodTask] })
      .expect(200);
    expect(service.save).toHaveBeenCalledWith('edit', 'software-engineer', [goodTask]);
  });

  it('a missing owner is a 400 naming the owner and the task (AC7)', async () => {
    ({ app } = await setup({ ok: false, code: 'owner_missing', taskIndex: 0 }));
    const res = await request(app.getHttpServer())
      .post('/onboarding-templates')
      .set(...as('hr'))
      .send({ role: 'software-engineer', tasks: [{ title: 'A', dueOffsetDays: 1 }] })
      .expect(400);
    expect(res.body).toMatchObject({ code: 'owner_missing', taskIndex: 0 });
    expect(res.body.message).toMatch(/owner/i);
  });

  it('a missing due date is a 400 naming the due date (AC8)', async () => {
    ({ app } = await setup({ ok: false, code: 'due_missing', taskIndex: 0 }));
    const res = await request(app.getHttpServer())
      .post('/onboarding-templates')
      .set(...as('hr'))
      .send(body)
      .expect(400);
    expect(res.body.message).toMatch(/due date/i);
  });

  it('day 91 is a 400 saying day 90 is the latest allowed (AC9)', async () => {
    ({ app } = await setup({ ok: false, code: 'due_too_late', taskIndex: 0 }));
    const res = await request(app.getHttpServer())
      .put('/onboarding-templates/software-engineer')
      .set(...as('hr'))
      .send({ tasks: [goodTask] })
      .expect(400);
    expect(res.body.message).toMatch(/day 90 is the latest allowed/i);
  });

  it('no tasks is a 400 (AC10)', async () => {
    ({ app } = await setup({ ok: false, code: 'no_tasks' }));
    const res = await request(app.getHttpServer())
      .post('/onboarding-templates')
      .set(...as('hr'))
      .send({ role: 'software-engineer', tasks: [] })
      .expect(400);
    expect(res.body).toMatchObject({ code: 'no_tasks' });
  });

  it('a second create for a role is a 409 role_exists (AC11)', async () => {
    ({ app } = await setup({ ok: false, code: 'role_exists' }));
    const res = await request(app.getHttpServer())
      .post('/onboarding-templates')
      .set(...as('hr'))
      .send(body)
      .expect(409);
    expect(res.body.code).toBe('role_exists');
  });

  it('editing a role with no template is a 404', async () => {
    ({ app } = await setup({ ok: false, code: 'not_found' }));
    await request(app.getHttpServer())
      .put('/onboarding-templates/software-engineer')
      .set(...as('hr'))
      .send({ tasks: [goodTask] })
      .expect(404);
  });

  it('a body that is not a role and a task list is a 400 and is not saved', async () => {
    let service;
    ({ app, service } = await setup());
    await request(app.getHttpServer())
      .post('/onboarding-templates')
      .set(...as('hr'))
      .send({ role: 5, tasks: 'x' })
      .expect(400);
    expect(service.save).not.toHaveBeenCalled();
  });
});
