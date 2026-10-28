import { BadRequestException, ConflictException } from '@nestjs/common';
import { HiresService } from './hires.service';
import { InMemoryHiresRepository } from './hires.repository';

const valid = { name: 'Ada', email: 'ada@example.com', role: 'Engineer', startDate: '2026-11-02' };

function setup() {
  const invites = { send: jest.fn() };
  const repo = new InMemoryHiresRepository();
  return { invites, repo, svc: new HiresService(repo, invites) };
}

describe('HiresService.create', () => {
  it('stores the hire as invited and sends the invite to the entered email', async () => {
    const { svc, invites } = setup();
    const hire = await svc.create({ ...valid, name: ' Ada ', email: ' ada@example.com ' });
    expect(hire).toMatchObject({ ...valid, status: 'invited' });
    expect(hire.id).toBeTruthy();
    expect(invites.send).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'ada@example.com', hireId: hire.id }),
    );
  });

  it.each([
    ['empty body', {}],
    ['non-object body', 'nope'],
    ['missing name', { ...valid, name: '' }],
    ['whitespace name', { ...valid, name: '   ' }],
    ['non-string name', { ...valid, name: 123 }],
    ['malformed email', { ...valid, email: 'bad' }],
    ['unknown role', { ...valid, role: 'Wizard' }],
    ['impossible date', { ...valid, startDate: '2026-02-30' }],
    ['wrong date format', { ...valid, startDate: '11/02/2026' }],
    ['bad month', { ...valid, startDate: '2026-13-01' }],
    ['empty date', { ...valid, startDate: '' }],
  ])('rejects %s with 400 and sends nothing', (_label, body) => {
    const { svc, invites } = setup();
    expect(() => svc.create(body)).toThrow(BadRequestException);
    expect(invites.send).not.toHaveBeenCalled();
  });

  it('reports every problem at once', () => {
    const { svc } = setup();
    try {
      svc.create({});
      fail('expected throw');
    } catch (e) {
      const { errors } = (e as BadRequestException).getResponse() as { errors: object };
      expect(Object.keys(errors).sort()).toEqual(['email', 'name', 'role', 'startDate']);
    }
  });

  it('accepts a past start date', async () => {
    const { svc } = setup();
    const hire = await svc.create({ ...valid, startDate: '2026-10-19' });
    expect(hire.status).toBe('invited');
  });

  it('rejects a duplicate email, trimmed and case-insensitive, without sending', async () => {
    const { svc, invites } = setup();
    await svc.create(valid);
    expect(() => svc.create({ ...valid, email: 'ADA@example.com ' })).toThrow(ConflictException);
    expect(() =>
      svc.create({ name: 'Other', email: ' Ada@Example.com', role: 'Finance', startDate: '2027-01-04' }),
    ).toThrow(ConflictException);
    expect(invites.send).toHaveBeenCalledTimes(1);
  });

  it('validation wins over duplicate', async () => {
    const { svc, invites } = setup();
    await svc.create(valid);
    expect(() => svc.create({ ...valid, role: '' })).toThrow(BadRequestException);
    expect(invites.send).toHaveBeenCalledTimes(1);
  });

  it('rolls back the hire with 502 when the invite cannot be sent, so it can be retried', async () => {
    const { svc, invites, repo } = setup();
    invites.send.mockRejectedValueOnce(new Error('queue down'));
    await expect(svc.create(valid)).rejects.toMatchObject({ status: 502 });
    expect(repo.findAll()).toEqual([]);
    await expect(svc.create(valid)).resolves.toMatchObject({ status: 'invited' });
  });
});
