import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { OrganizationsService } from './organizations.service';

const ID = '3f1c2a9e-0b1d-4c55-9a53-1f0d6e2b7c11';

function setup() {
  const pool = { query: jest.fn() };
  return { pool, service: new OrganizationsService({ pool } as unknown as DatabaseService) };
}

describe('OrganizationsService', () => {
  it('AC4: returns the saved details', async () => {
    const { pool, service } = setup();
    const org = { id: ID, name: 'Acme Giving', address: '1 High St' };
    pool.query.mockResolvedValue({ rows: [org] });
    expect(await service.get(ID)).toEqual(org);
  });

  it('answers 404 for a missing or malformed id without querying a bad id', async () => {
    const { pool, service } = setup();
    pool.query.mockResolvedValue({ rows: [], rowCount: 0 });
    await expect(service.get(ID)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.get('not-a-uuid')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove('not-a-uuid')).rejects.toBeInstanceOf(NotFoundException);
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('AC5: update trims, writes name and address, and returns the row', async () => {
    const { pool, service } = setup();
    pool.query.mockResolvedValue({ rows: [{ id: ID, name: 'Acme Giving Ltd', address: '2 Low Rd' }] });
    await service.update(ID, '  Acme Giving Ltd ', ' 2 Low Rd ');
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('updated_at = now()');
    expect(params).toEqual([ID, 'Acme Giving Ltd', '2 Low Rd']);
  });

  it('refuses a blank name and writes nothing', async () => {
    const { pool, service } = setup();
    await expect(service.update(ID, '   ', 'x')).rejects.toBeInstanceOf(BadRequestException);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('AC7: remove deletes the row, 404 when none matched', async () => {
    const { pool, service } = setup();
    pool.query.mockResolvedValueOnce({ rowCount: 1 });
    await expect(service.remove(ID)).resolves.toBeUndefined();
    pool.query.mockResolvedValueOnce({ rowCount: 0 });
    await expect(service.remove(ID)).rejects.toBeInstanceOf(NotFoundException);
  });
});
