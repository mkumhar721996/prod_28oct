import { BOOK_APPOINTMENT_HREF } from "@/lib/shell";

export function NoAppointments() {
  return (
    <div className="empty-state">
      <h2>No upcoming appointments</h2>
      <p>Book your first visit online. Pick a clinic and a time that suits you.</p>
      <a className="btn btn-primary" href={BOOK_APPOINTMENT_HREF}>
        Book appointment
      </a>
    </div>
  );
}
