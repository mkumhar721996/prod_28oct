import { redirect } from "next/navigation";
import { AppointmentsScreen } from "@/components/appointments/AppointmentsScreen";
import { getAppointments } from "@/lib/appointments";
import { getSession } from "@/lib/session";
import { APPOINTMENTS_HREF, SIGN_IN_HREF } from "@/lib/shell";

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ booked?: string }>;
}) {
  // Signed-out visitors never get appointment data; sign-in brings them back via `next`.
  if ((await getSession()) === null) {
    redirect(`${SIGN_IN_HREF}?next=${encodeURIComponent(APPOINTMENTS_HREF)}`);
  }
  const [{ booked }, appointments] = await Promise.all([searchParams, getAppointments()]);
  return (
    <AppointmentsScreen
      appointments={appointments}
      now={new Date().toISOString()}
      justBooked={booked === "1"}
    />
  );
}
