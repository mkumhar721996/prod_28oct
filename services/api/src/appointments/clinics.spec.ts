import {
  CLINICS,
  clinicLocalToUtc,
  isOfferedSlot,
  slotsFor,
  utcToClinicLocal,
} from './clinics';

const north = CLINICS.find((c) => c.id === 'north')!;
const central = CLINICS.find((c) => c.id === 'central')!;
const NOW = new Date('2026-10-29T10:00:00Z');

describe('CLINICS', () => {
  it('is a fixed list', () => {
    expect(CLINICS.map((c) => c.id)).toEqual(['central', 'north', 'riverside']);
  });
});

describe('time zone helpers', () => {
  it('converts winter and summer clinic wall time to UTC', () => {
    expect(clinicLocalToUtc('Europe/London', '2026-11-02', '09:00').toISOString()).toBe(
      '2026-11-02T09:00:00.000Z',
    );
    expect(clinicLocalToUtc('Europe/London', '2026-07-06', '09:00').toISOString()).toBe(
      '2026-07-06T08:00:00.000Z',
    );
  });

  it.each([
    ['2026-11-02', '09:00'],
    ['2026-07-06', '11:30'],
    ['2026-03-30', '09:30'],
  ])('round-trips %s %s', (d, t) => {
    const tz = 'Europe/London';
    expect(utcToClinicLocal(tz, clinicLocalToUtc(tz, d, t))).toEqual({ date: d, time: t });
  });
});

describe('slotsFor', () => {
  it('offers only Mondays 09:00 to 12:00 for North Clinic', () => {
    const days = slotsFor(north, NOW, new Set());
    expect(days.length).toBeGreaterThan(0);
    for (const d of days) {
      expect(new Date(d.date + 'T00:00:00Z').getUTCDay()).toBe(1);
      for (const t of d.times) expect(t >= '09:00' && t < '12:00').toBe(true);
    }
    expect(days[0].date).toBe('2026-11-02');
    expect(days[0].times).toEqual(['09:00', '09:30', '10:00', '10:30', '11:00', '11:30']);
  });

  it('starts tomorrow and covers 14 days', () => {
    const days = slotsFor(central, NOW, new Set());
    expect(days[0].date).toBe('2026-10-30');
    expect(days[days.length - 1].date <= '2026-11-12').toBe(true);
  });

  it('omits taken slots, keyed by UTC instant', () => {
    const taken = new Set(['2026-11-02T09:00:00.000Z']);
    const days = slotsFor(north, NOW, taken);
    expect(days[0].times).not.toContain('09:00');
    expect(days[0].times).toContain('09:30');
  });

  it('omits a day with no free times', () => {
    const taken = new Set(
      ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30'].map((t) =>
        clinicLocalToUtc('Europe/London', '2026-11-02', t).toISOString(),
      ),
    );
    expect(slotsFor(north, NOW, taken).map((d) => d.date)).not.toContain('2026-11-02');
  });
});

describe('isOfferedSlot', () => {
  it('accepts an offered slot and rejects others', () => {
    expect(isOfferedSlot(north, '2026-11-02', '09:00', NOW)).toBe(true);
    expect(isOfferedSlot(north, '2026-11-02', '12:00', NOW)).toBe(false);
    expect(isOfferedSlot(north, '2026-11-02', '09:15', NOW)).toBe(false);
    expect(isOfferedSlot(north, '2026-11-03', '09:00', NOW)).toBe(false);
    expect(isOfferedSlot(north, '2026-10-29', '09:00', NOW)).toBe(false);
    expect(isOfferedSlot(north, '2027-01-04', '09:00', NOW)).toBe(false);
    expect(isOfferedSlot(north, 'nonsense', '09:00', NOW)).toBe(false);
  });
});
