import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CLINICS, Clinic, clinicLocalToUtc, isOfferedSlot, slotsFor, utcToClinicLocal } from './clinics';

export const REASON_MAX = 500;
const CLINIC_SLOT_INDEX = 'appointments_clinic_slot_uniq';
const PLAYER_SLOT_INDEX = 'appointments_player_slot_uniq';
const UNIQUE_VIOLATION = '23505';

export type AppointmentView = {
  id: string;
  clinicId: string;
  clinicName: string;
  /** Clinic-local date (YYYY-MM-DD) and time (HH:mm). */
  date: string;
  time: string;
  /** The slot's start as a UTC ISO instant. */
  startsAt: string;
  reason: string;
};

export type BookInput = { clinicId: string; date: string; time: string; reason: string };
export type BookRefusal =
  | 'slot_taken'
  | 'already_booked'
  | 'not_offered'
  | 'reason_too_long'
  | 'unknown_clinic';
export type BookResult =
  | { ok: true; appointment: AppointmentView }
  | { ok: false; code: BookRefusal };

type Row = { id: string; clinic_id: string; slot_start: Date; reason: string };

@Injectable()
export class AppointmentsService {
  /** The clock; replaced in tests. */
  now: () => Date = () => new Date();

  constructor(private readonly db: DatabaseService) {}

  /** The same fixed list for every patient. */
  listClinics(): Clinic[] {
    return [...CLINICS];
  }

  /** Free slots at a clinic (every patient's bookings removed); null for an unknown clinic. */
  async slotsForClinic(clinicId: string): Promise<{ date: string; times: string[] }[] | null> {
    const clinic = CLINICS.find((c) => c.id === clinicId);
    if (!clinic) return null;
    const { rows } = await this.db.pool.query(
      'select slot_start from appointments where clinic_id = $1 and slot_start > now()',
      [clinic.id],
    );
    const taken = new Set<string>(rows.map((r: { slot_start: Date }) => r.slot_start.toISOString()));
    return slotsFor(clinic, this.now(), taken);
  }

  /** The patient's own bookings, soonest first. */
  async listFor(playerId: string): Promise<AppointmentView[]> {
    const { rows } = await this.db.pool.query(
      'select id, clinic_id, slot_start, reason from appointments where player_id = $1 order by slot_start',
      [playerId],
    );
    return rows.map((r: Row) => this.view(r));
  }

  /**
   * The database decides: the two unique indexes refuse a taken slot and a second booking at the
   * same time, so concurrent confirms cannot double book. Any other failure is rethrown.
   */
  async book(playerId: string, input: BookInput): Promise<BookResult> {
    if (input.reason.length > REASON_MAX) return { ok: false, code: 'reason_too_long' };
    const clinic = CLINICS.find((c) => c.id === input.clinicId);
    if (!clinic) return { ok: false, code: 'unknown_clinic' };
    if (!isOfferedSlot(clinic, input.date, input.time, this.now())) {
      return { ok: false, code: 'not_offered' };
    }
    const start = clinicLocalToUtc(clinic.timeZone, input.date, input.time);
    try {
      const { rows } = await this.db.pool.query(
        'insert into appointments (player_id, clinic_id, slot_start, reason) values ($1, $2, $3, $4) returning id, clinic_id, slot_start, reason',
        [playerId, clinic.id, start.toISOString(), input.reason],
      );
      return { ok: true, appointment: this.view(rows[0]) };
    } catch (err) {
      const e = err as { code?: string; constraint?: string };
      if (e.code === UNIQUE_VIOLATION && e.constraint === CLINIC_SLOT_INDEX) {
        return { ok: false, code: 'slot_taken' };
      }
      if (e.code === UNIQUE_VIOLATION && e.constraint === PLAYER_SLOT_INDEX) {
        return { ok: false, code: 'already_booked' };
      }
      throw err;
    }
  }

  private view(row: Row): AppointmentView {
    const clinic = CLINICS.find((c) => c.id === row.clinic_id)!;
    const local = utcToClinicLocal(clinic.timeZone, row.slot_start);
    return {
      id: row.id,
      clinicId: clinic.id,
      clinicName: clinic.name,
      date: local.date,
      time: local.time,
      startsAt: row.slot_start.toISOString(),
      reason: row.reason,
    };
  }
}
