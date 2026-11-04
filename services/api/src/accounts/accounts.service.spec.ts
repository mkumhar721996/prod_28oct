import { BadRequestException, ConflictException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { PasswordService } from '../players/password.service';
import { AccountsService } from './accounts.service';
import { ROLES } from './accounts.constants';

function setup() {
  const pool = { query: jest.fn() };
  const passwords = new PasswordService();
  return {
    pool,
    passwords,
    service: new AccountsService({ pool } as unknown as DatabaseService, passwords),
  };
}

describe('AccountsService.create', () => {
  it.each(ROLES)('AC9: stores exactly the one chosen role (%s)', async (role) => {
    const { pool, service } = setup();
    pool.query.mockResolvedValue({ rows: [{ id: 'u1', email: 'a@org.example', role }] });
    await expect(service.create('A@org.example', 'Welcome-2026', role)).resolves.toEqual({
      id: 'u1',
      email: 'a@org.example',
      role,
    });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('insert into app_users');
    expect(params[0]).toBe('a@org.example');
    expect(params[1]).not.toBe('Welcome-2026');
    expect(params[2]).toBe(role);
  });

  it.each(['owner', ['staff', 'super_admin'], undefined])(
    'AC9: refuses role %p and writes nothing',
    async (role) => {
      const { pool, service } = setup();
      await expect(service.create('a@org.example', 'Welcome-2026', role)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(pool.query).not.toHaveBeenCalled();
    },
  );

  it('refuses a bad email and a short password', async () => {
    const { pool, service } = setup();
    await expect(service.create('nope', 'Welcome-2026', 'staff')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.create('a@org.example', 'short', 'staff')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('answers 409 for a duplicate email', async () => {
    const { pool, service } = setup();
    pool.query.mockRejectedValue({ code: '23505' });
    await expect(service.create('a@org.example', 'Welcome-2026', 'staff')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});

describe('AccountsService.authenticate', () => {
  it('AC10: returns the user with role for the right password', async () => {
    const { pool, passwords, service } = setup();
    const hash = await passwords.hash('Welcome-2026');
    pool.query.mockResolvedValue({
      rows: [{ id: 'u1', email: 'a@org.example', role: 'staff', password_hash: hash }],
    });
    expect(await service.authenticate('a@org.example', 'Welcome-2026')).toEqual({
      id: 'u1',
      email: 'a@org.example',
      role: 'staff',
    });
    expect(pool.query.mock.calls[0][0]).toContain('from app_users');
  });

  it('returns null for a wrong password and for an unknown email', async () => {
    const { pool, passwords, service } = setup();
    const hash = await passwords.hash('Welcome-2026');
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 'u1', email: 'a@org.example', role: 'staff', password_hash: hash }],
    });
    expect(await service.authenticate('a@org.example', 'wrong-pass-1')).toBeNull();
    pool.query.mockResolvedValueOnce({ rows: [] });
    expect(await service.authenticate('x@org.example', 'Welcome-2026')).toBeNull();
  });
});

describe('AccountsService.ensureSuperAdmin', () => {
  it('AC13: creates a super_admin when the email is new', async () => {
    const { pool, service } = setup();
    pool.query.mockResolvedValue({ rows: [{ id: 'u1' }] });
    expect(await service.ensureSuperAdmin('root@org.example', 'Seeded-pass-1')).toBe('created');
    expect(pool.query.mock.calls[0][0]).toContain('on conflict (email) do nothing');
    expect(pool.query.mock.calls[0][1][2]).toBe('super_admin');
  });

  it('AC13: a second run changes nothing', async () => {
    const { pool, service } = setup();
    pool.query.mockResolvedValue({ rows: [] });
    expect(await service.ensureSuperAdmin('root@org.example', 'Seeded-pass-1')).toBe('exists');
  });

  it('list returns accounts oldest first, one role each, no hash', async () => {
    const { pool, service } = setup();
    const rows = [{ id: 'u1', email: 'a@org.example', role: 'staff' }];
    pool.query.mockResolvedValue({ rows });
    expect(await service.list()).toEqual(rows);
    expect(pool.query.mock.calls[0][0]).not.toContain('password_hash');
    expect(pool.query.mock.calls[0][0]).toContain('order by created_at');
  });

  it('refuses unset credentials', async () => {
    const { pool, service } = setup();
    await expect(service.ensureSuperAdmin(undefined, undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(pool.query).not.toHaveBeenCalled();
  });
});
