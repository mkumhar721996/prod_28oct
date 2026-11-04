import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export type Organization = { id: string; name: string; address: string };

const COLUMNS = 'id, name, address';
// A malformed id can never match a uuid column; answer 404 instead of letting Postgres raise.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class OrganizationsService {
  constructor(private readonly db: DatabaseService) {}

  async list(): Promise<Pick<Organization, 'id' | 'name'>[]> {
    const { rows } = await this.db.pool.query('select id, name from organizations order by name');
    return rows;
  }

  async get(id: string): Promise<Organization> {
    if (!UUID_PATTERN.test(id)) throw new NotFoundException('Organization not found.');
    const { rows } = await this.db.pool.query(
      `select ${COLUMNS} from organizations where id = $1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Organization not found.');
    return rows[0] as Organization;
  }

  /** The only write path for edits: nothing unsaved is ever stored server side. */
  async update(id: string, name: unknown, address: unknown): Promise<Organization> {
    const trimmedName = typeof name === 'string' ? name.trim() : '';
    if (!trimmedName) throw new BadRequestException('Enter a name');
    if (address !== undefined && typeof address !== 'string') {
      throw new BadRequestException('Enter an address as text');
    }
    if (!UUID_PATTERN.test(id)) throw new NotFoundException('Organization not found.');
    const { rows } = await this.db.pool.query(
      `update organizations set name = $2, address = coalesce($3, address), updated_at = now()
       where id = $1 returning ${COLUMNS}`,
      [id, trimmedName, typeof address === 'string' ? address.trim() : null],
    );
    if (!rows[0]) throw new NotFoundException('Organization not found.');
    return rows[0] as Organization;
  }

  async remove(id: string): Promise<void> {
    if (!UUID_PATTERN.test(id)) throw new NotFoundException('Organization not found.');
    const { rowCount } = await this.db.pool.query('delete from organizations where id = $1', [id]);
    if (!rowCount) throw new NotFoundException('Organization not found.');
  }
}
