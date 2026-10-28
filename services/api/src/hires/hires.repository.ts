export type Hire = {
  id: string;
  name: string;
  email: string;
  role: string;
  startDate: string;
  status: 'invited';
};

export interface HiresRepository {
  findAll(): Hire[];
  findByEmail(email: string): Hire | undefined;
  insert(hire: Hire): void;
  remove(id: string): void;
}

export const HIRES_REPOSITORY = Symbol('HIRES_REPOSITORY');

/** Synchronous, so check-then-insert in the service cannot interleave between requests. */
export class InMemoryHiresRepository implements HiresRepository {
  private readonly hires: Hire[] = [];

  findAll(): Hire[] {
    return [...this.hires];
  }

  findByEmail(email: string): Hire | undefined {
    const wanted = email.trim().toLowerCase();
    return this.hires.find((h) => h.email.toLowerCase() === wanted);
  }

  insert(hire: Hire): void {
    this.hires.push(hire);
  }

  remove(id: string): void {
    const i = this.hires.findIndex((h) => h.id === id);
    if (i >= 0) this.hires.splice(i, 1);
  }
}
