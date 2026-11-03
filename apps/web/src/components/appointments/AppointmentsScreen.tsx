"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { dayLabel, describeAppointment, splitUpcoming, type Appointment } from "@/lib/appointments";
import { APPOINTMENTS_HREF, BOOK_APPOINTMENT_HREF } from "@/lib/shell";
import { AppointmentDetail } from "./AppointmentDetail";
import { NoAppointments } from "./NoAppointments";
import { Toast } from "./Toast";

type TabId = "upcoming" | "past";

const TABS: readonly { id: TabId; label: string }[] = [
  { id: "upcoming", label: "Upcoming" },
  { id: "past", label: "Past" },
];

type Props = {
  appointments: Appointment[];
  /** ISO instant the server split upcoming from past at. */
  now: string;
  /** True when the patient has just confirmed a booking: shows the toast once. */
  justBooked?: boolean;
  initialTab?: TabId;
};

function AppointmentList({
  items,
  label,
  onOpen,
}: {
  items: Appointment[];
  label: string;
  onOpen: (id: string) => void;
}) {
  return (
    <ul className="stack stack-2 plain-list" aria-label={label}>
      {items.map((a) => (
        <li key={a.id}>
          <button
            type="button"
            className="card appt"
            aria-label={`Open appointment at ${describeAppointment(a)}`}
            onClick={() => onOpen(a.id)}
          >
            <span className="appt-patient">{a.clinicName}</span>
            <span className="text-muted">
              {dayLabel(a.date)}, {a.time}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function AppointmentsScreen({ appointments, now, justBooked = false, initialTab }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>(initialTab ?? "upcoming");
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState(justBooked);
  const hideToast = useCallback(() => setToast(false), []);
  const { upcoming, past } = splitUpcoming(appointments, new Date(now));

  // The toast shows once: drop ?booked=1 so a refresh does not repeat it.
  useEffect(() => {
    if (justBooked) router.replace(APPOINTMENTS_HREF);
  }, [justBooked, router]);

  if (appointments.length === 0) {
    return (
      <div className="page stack stack-4">
        <h1>Appointments</h1>
        <NoAppointments />
        {toast && <Toast message="Appointment booked" onHide={hideToast} />}
      </div>
    );
  }

  const open = appointments.find((a) => a.id === openId);
  if (open) {
    return (
      <AppointmentDetail
        appointment={open}
        upcoming={upcoming.includes(open)}
        onBack={() => setOpenId(null)}
      />
    );
  }

  return (
    <div className="page stack stack-4">
      <div className="title-row">
        <h1>Appointments</h1>
        <a className="btn btn-primary" href={BOOK_APPOINTMENT_HREF}>
          Book appointment
        </a>
      </div>

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            type="button"
            className="tab"
            role="tab"
            key={t.id}
            id={`tab-${t.id}`}
            aria-controls={`panel-${t.id}`}
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "upcoming" &&
          (upcoming.length === 0 ? (
            <p className="text-muted">No upcoming appointments.</p>
          ) : (
            <AppointmentList items={upcoming} label="Upcoming appointments" onOpen={setOpenId} />
          ))}
        {tab === "past" &&
          (past.length === 0 ? (
            <p className="text-muted">No past appointments.</p>
          ) : (
            <AppointmentList items={past} label="Past appointments" onOpen={setOpenId} />
          ))}
      </div>

      {toast && <Toast message="Appointment booked" onHide={hideToast} />}
    </div>
  );
}
