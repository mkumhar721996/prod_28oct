import { DatabaseService } from '../database/database.service';
import { AppointmentsService } from './appointments.service';

const NOW = new Date('2026-10-29T10:00:00Z');

function setup(handler: (sql: string, params?: unknown[]) => unknown = () => ({ rows: [] })) {
  const query = jest.fn(async (sql: string, params?: unknown[]) => handler(sql, params));
  const service = new AppointmentsService({ pool: { query } } as unknown as DatabaseService);
  service.now = () => NOW;
  return { service, query };
}

const violation = (constraint: string) => Object.assign(new Error('duplicate'), { code: '23505', constraint });
const input = { clinicId: 'north', date: '2026-11-02', time: '09:00', reason: '' };
const inserted = {
  id: 'a1',
  clinic_id: 'north',
  slot_start: new Date('2026-11-02T09:00:00Z'),
  reason: '',
};

describe('AppointmentsService', () => {
  it('lists the same fixed clinics for everyone', () => {
    const { service } = setup();
    expect(service.listClinics().map((c) => c.id)).toEqual(['central', 'north', 'riverside']);
    expect(service.listClinics()).toEqual(service.listClinics());
  });

  describe('slotsForClinic', () => {
    it('is null for an unknown clinic', async () => {
      expect(await setup().service.slotsForClinic('nope')).toBeNull();
    });

    it('omits a slot booked by another patient', async () => {
      const { service } = setup(() => ({ rows: [{ slot_start: new Date('2026-11-02T09:00:00Z') }] }));
      const days = (await service.slotsForClinic('north'))!;
      expect(days[0].date).toBe('2026-11-02');
      expect(days[0].times).not.toContain('09:00');
      expect(days[0].times).toContain('09:30');
    });
  });

  describe('book', () => {
    it('inserts and returns the booking in clinic-local time', async () => {
      const { service, query } = setup(() => ({ rows: [inserted] }));
      const result = await service.book('p1', input);
      expect(result).toMatchObject({
        ok: true,
        appointment: { clinicName: 'North Clinic', date: '2026-11-02', time: '09:00' },
      });
      expect(query.mock.calls[0][1]).toEqual(['p1', 'north', '2026-11-02T09:00:00.000Z', '']);
    });

    it('shows summer bookings in clinic-local time, not UTC', async () => {
      const { service } = setup(() => ({
        rows: [{ ...inserted, slot_start: new Date('2026-07-06T08:00:00Z') }],
      }));
      const [a] = await service.listFor('p1');
      expect([a.date, a.time]).toEqual(['2026-07-06', '09:00']);
    });

    it('accepts a 500 character reason and refuses 501', async () => {
      const { service, query } = setup(() => ({ rows: [inserted] }));
      expect((await service.book('p1', { ...input, reason: 'a'.repeat(500) })).ok).toBe(true);
      query.mockClear();
      expect(await service.book('p1', { ...input, reason: 'a'.repeat(501) })).toEqual({
        ok: false,
        code: 'reason_too_long',
      });
      expect(query).not.toHaveBeenCalled();
    });

    it('refuses an unknown clinic and a slot not offered', async () => {
      const { service, query } = setup();
      expect(await service.book('p1', { ...input, clinicId: 'nope' })).toEqual({
        ok: false,
        code: 'unknown_clinic',
      });
      expect(await service.book('p1', { ...input, time: '15:00' })).toEqual({
        ok: false,
        code: 'not_offered',
      });
      expect(query).not.toHaveBeenCalled();
    });

    it('maps the clinic slot index to slot_taken', async () => {
      const { service } = setup(() => {
        throw violation('appointments_clinic_slot_uniq');
      });
      expect(await service.book('p2', input)).toEqual({ ok: false, code: 'slot_taken' });
    });

    it('maps the player slot index to already_booked, also at another clinic', async () => {
      const { service } = setup(() => {
        throw violation('appointments_player_slot_uniq');
      });
      const result = await service.book('p1', {
        clinicId: 'riverside',
        date: '2026-11-03',
        time: '09:30',
        reason: '',
      });
      expect(result).toEqual({ ok: false, code: 'already_booked' });
    });

    it('rethrows any other database error', async () => {
      const { service } = setup(() => {
        throw new Error('connection lost');
      });
      await expect(service.book('p1', input)).rejects.toThrow('connection lost');
    });

    it('rethrows a unique violation of an unknown constraint', async () => {
      const { service } = setup(() => {
        throw violation('something_else');
      });
      await expect(service.book('p1', input)).rejects.toThrow();
    });
  });

  describe('listFor', () => {
    it('reads only the given patient own rows, and is empty when none', async () => {
      const { service, query } = setup();
      expect(await service.listFor('p1')).toEqual([]);
      expect(query.mock.calls[0][1]).toEqual(['p1']);
    });

    it('includes a just-booked appointment', async () => {
      const { service } = setup(() => ({ rows: [inserted] }));
      const list = await service.listFor('p1');
      expect(list.map((a) => [a.date, a.time])).toContainEqual(['2026-11-02', '09:00']);
    });
  });
});
