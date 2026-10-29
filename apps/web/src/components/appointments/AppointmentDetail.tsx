"use client";

import { useEffect, useRef, useState } from "react";
import { describeDateTime, reasonText, zoneNote, NO_REASON_TEXT, type Appointment } from "@/lib/appointments";
import { Icon } from "../orders/Icon";

type Props = {
  appointment: Appointment;
  /** From the list's own upcoming/past split, so the badge always agrees with the tab. */
  upcoming: boolean;
  onBack: () => void;
};

export function AppointmentDetail({ appointment, upcoming, onBack }: Props) {
  const backRef = useRef<HTMLButtonElement>(null);
  // Only the browser knows the device zone; read after mount so server and client markup match.
  const [deviceZone, setDeviceZone] = useState<string | null>(null);
  useEffect(() => {
    backRef.current?.focus();
    setDeviceZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  const reason = reasonText(appointment);
  const note = deviceZone ? zoneNote(appointment, deviceZone) : null;

  return (
    <div className="page stack stack-4">
      <button type="button" className="btn btn-ghost back" ref={backRef} onClick={onBack}>
        <Icon name="arrow-left" /> Back to Appointments
      </button>
      <div className="title-row">
        <h1 id="detail-title">Appointment</h1>
        <span className="badge">{upcoming ? "Upcoming" : "Past"}</span>
      </div>
      <div className="card stack stack-3" aria-labelledby="detail-title">
        <div className="d-group">
          <span className="d-label">Clinic</span>
          <h2 className="d-value">{appointment.clinicName}</h2>
        </div>
        <div className="d-group">
          <span className="d-label">Date and time</span>
          <span className="d-value">{describeDateTime(appointment)}</span>
          {note && (
            <div className="alert alert-info">
              <Icon name="info" />
              <p>{note}</p>
            </div>
          )}
        </div>
        <div className="d-group">
          <span className="d-label">Reason for visit</span>
          <span className={`d-value d-reason${reason === NO_REASON_TEXT ? " is-empty" : ""}`}>{reason}</span>
        </div>
      </div>
      <p className="text-sm text-muted">To change this appointment, contact the clinic.</p>
    </div>
  );
}
