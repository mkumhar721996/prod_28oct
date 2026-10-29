"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  REASON_MAX,
  bookAppointment,
  canConfirm,
  dayLabel,
  fetchSlots,
  reasonError,
  type BookInput,
  type Clinic,
  type Slot,
  type SlotDay,
} from "@/lib/appointments";
import { APPOINTMENTS_HREF } from "@/lib/shell";
import { Icon } from "../orders/Icon";
import { ClinicSlotPicker, type SlotsStatus } from "./ClinicSlotPicker";

export type BookingAlert = { kind: "warning" | "danger"; title: string; text: string };

export type ConfirmOutcome =
  | { type: "booked" }
  | { type: "slot_taken"; alert: BookingAlert; days: SlotDay[] | null }
  | { type: "already_booked"; alert: BookingAlert }
  | { type: "error"; alert: BookingAlert };

/** Books, then decides what the page shows. A taken slot also refetches the free times. */
export async function runConfirm(
  deps: { bookAppointment: typeof bookAppointment; fetchSlots: typeof fetchSlots },
  input: BookInput,
): Promise<ConfirmOutcome> {
  const result = await deps.bookAppointment(input);
  if (result.ok) return { type: "booked" };
  if (result.kind === "slot_taken") {
    const days = await deps.fetchSlots(input.clinicId).catch(() => null);
    return {
      type: "slot_taken",
      days,
      alert: { kind: "warning", title: "That time is no longer available", text: result.message },
    };
  }
  if (result.kind === "already_booked") {
    return {
      type: "already_booked",
      alert: { kind: "warning", title: "You already have a booking then", text: result.message },
    };
  }
  return {
    type: "error",
    alert: { kind: "danger", title: "We couldn't book your appointment", text: result.message },
  };
}

type Initial = {
  clinicId?: string;
  slot?: Slot | null;
  reason?: string;
  days?: SlotDay[];
  slotsStatus?: SlotsStatus;
  alert?: BookingAlert | null;
  pending?: boolean;
};

export function BookingScreen({ clinics, initial }: { clinics: Clinic[]; initial?: Initial }) {
  const router = useRouter();
  const [clinicId, setClinicId] = useState(initial?.clinicId ?? "");
  const [slot, setSlot] = useState<Slot | null>(initial?.slot ?? null);
  const [reason, setReason] = useState(initial?.reason ?? "");
  const [days, setDays] = useState<SlotDay[]>(initial?.days ?? []);
  const [slotsStatus, setSlotsStatus] = useState<SlotsStatus>(initial?.slotsStatus ?? "ready");
  const [alert, setAlert] = useState<BookingAlert | null>(initial?.alert ?? null);
  const [pending, setPending] = useState(initial?.pending ?? false);
  const alertRef = useRef<HTMLDivElement>(null);
  // The clinic whose slots are loaded, so the initial (test) state does not trigger a fetch.
  const loadedFor = useRef(initial?.clinicId ?? "");

  useEffect(() => {
    if (alert) alertRef.current?.focus();
  }, [alert]);

  useEffect(() => {
    if (clinicId === "" || loadedFor.current === clinicId) return;
    loadedFor.current = clinicId;
    let current = true;
    setSlotsStatus("loading");
    fetchSlots(clinicId).then(
      (loaded) => {
        if (!current) return;
        setDays(loaded);
        setSlotsStatus("ready");
      },
      () => current && setSlotsStatus("error"),
    );
    return () => {
      current = false;
    };
  }, [clinicId]);

  const clinic = clinics.find((c) => c.id === clinicId);
  const error = reasonError(reason.length);
  const enabled = canConfirm({ clinicId, slot, reasonLength: reason.length }) && !pending;

  function chooseClinic(id: string) {
    setClinicId(id);
    setSlot(null);
    setDays([]);
    setAlert(null);
    if (id === "") loadedFor.current = "";
  }

  async function confirm() {
    if (!slot || !enabled) return;
    setPending(true);
    setAlert(null);
    const outcome = await runConfirm(
      { bookAppointment, fetchSlots },
      { clinicId, date: slot.date, time: slot.time, reason },
    );
    if (outcome.type === "booked") {
      router.push(`${APPOINTMENTS_HREF}?booked=1`);
      return;
    }
    setPending(false);
    if (outcome.type === "slot_taken") {
      setSlot(null);
      if (outcome.days) setDays(outcome.days);
    }
    setAlert(outcome.alert);
  }

  return (
    <div className="page stack stack-4">
      <h1>Book appointment</h1>

      {alert && (
        <div className={`alert alert-${alert.kind}`} role="alert" tabIndex={-1} ref={alertRef}>
          <Icon name={alert.kind === "danger" ? "alert" : "info"} />
          <div>
            <strong>{alert.title}</strong>
            <p>{alert.text}</p>
          </div>
        </div>
      )}

      <div className="field">
        <label htmlFor="clinic">Clinic</label>
        <select
          className="select"
          id="clinic"
          aria-describedby="clinic-hours"
          value={clinicId}
          onChange={(e) => chooseClinic(e.target.value)}
        >
          <option value="">Choose clinic</option>
          {clinics.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <p className="field-hint" id="clinic-hours">
          {clinic?.hoursText ?? "Choose a clinic to see its opening hours and free times."}
        </p>
      </div>

      <div className="field">
        <label htmlFor="reason">Reason for visit (optional)</label>
        <textarea
          className={`textarea${error ? " is-invalid" : ""}`}
          id="reason"
          placeholder="For example: check-up on my blood pressure"
          aria-describedby="reason-count reason-error"
          aria-invalid={error ? true : undefined}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className={`counter${error ? " is-over" : ""}`} id="reason-count" aria-live="polite">
          {reason.length} / {REASON_MAX}
        </div>
        {error && (
          <p className="field-error" id="reason-error">
            {error}
          </p>
        )}
      </div>

      <ClinicSlotPicker
        clinicChosen={clinic !== undefined}
        status={slotsStatus}
        days={days}
        selected={slot}
        onSelect={(next) => {
          setSlot(next);
          setAlert(null);
        }}
      />

      <p className="field-hint" aria-live="polite">
        {clinic && slot
          ? `${clinic.name}, ${dayLabel(slot.date)}, ${slot.time}`
          : "Choose a clinic and a time to continue."}
      </p>

      <div className="actions">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={pending}
          onClick={() => router.push(APPOINTMENTS_HREF)}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!enabled}
          aria-disabled={!enabled}
          onClick={confirm}
        >
          {pending ? "Booking…" : "Confirm"}
        </button>
      </div>
    </div>
  );
}
