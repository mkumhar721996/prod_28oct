import { BadRequestException, ConflictException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { PasswordService } from '../players/password.service';
import { StaffService } from './staff.service';

function setup() {
  const pool = { query: jest.fn() };
  const passwords = new PasswordService();
  const service = new StaffService({ pool } as unknown as DatabaseService, passwords);
  return { pool, passwords, service };
}

describe('StaffService.authenticate', () => {
  it('returns null when the staff table has no row (e.g. a customer email)', async () => {
    const { pool, service } = setup();
    pool.query.mockResolvedValue({ rows: [] });
    expect(await service.authenticate('jo.carter@example.com', 'Cust-pass1')).toBeNull();
    expect(pool.query.mock.calls[0][0]).toContain('from staff_accounts');
  });

  it('returns null for a wrong password after one verify', async () => {
    const { pool, passwords, service } = setup();
    const hash = await passwords.hash('Staff-pass1');
    pool.query.mockResolvedValue({ rows: [{ id: 's1', email: 'a@bank.example', password_hash: hash }] });
    const verify = jest.spyOn(passwords, 'verify');
    expect(await service.authenticate('a@bank.example', 'wrong-pass')).toBeNull();
    expect(verify).toHaveBeenCalledTimes(1);
  });

  it('returns the staff member for the right password', async () => {
    const { pool, passwords, service } = setup();
    const hash = await passwords.hash('Staff-pass1');
    pool.query.mockResolvedValue({ rows: [{ id: 's1', email: 'a@bank.example', password_hash: hash }] });
    expect(await service.authenticate(' A@bank.example ', 'Staff-pass1')).toEqual({
      id: 's1',
      email: 'a@bank.example',
    });
    expect(pool.query.mock.calls[0][1]).toEqual(['a@bank.example']);
  });
});

describe('StaffService.create', () => {
  it('stores a scrypt hash, never the password, and returns id and email', async () => {
    const { pool, service } = setup();
    pool.query.mockResolvedValue({ rows: [{ id: 's2', email: 'new.hire@bank.example' }] });
    expect(await service.create('new.hire@bank.example', 'Welcome-2026')).toEqual({
      id: 's2',
      email: 'new.hire@bank.example',
    });
    const stored = pool.query.mock.calls[0][1][1];
    expect(stored).not.toBe('Welcome-2026');
    expect(stored).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);
  });

  it('409 on a duplicate email', async () => {
    const { pool, service } = setup();
    pool.query.mockRejectedValue({ code: '23505' });
    await expect(service.create('a@bank.example', 'Welcome-2026')).rejects.toBeInstanceOf(ConflictException);
  });

  it('400 on a bad email or a short password', async () => {
    const { pool, service } = setup();
    await expect(service.create('nope', 'Welcome-2026')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create('a@bank.example', 'short')).rejects.toBeInstanceOf(BadRequestException);
    expect(pool.query).not.toHaveBeenCalled();
  });
});
