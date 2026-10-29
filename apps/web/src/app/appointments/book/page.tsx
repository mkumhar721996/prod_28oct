import { redirect } from "next/navigation";
import { BookingScreen } from "@/components/appointments/BookingScreen";
import { getClinics } from "@/lib/appointments";
import { getSession } from "@/lib/session";
import { BOOK_APPOINTMENT_HREF, SIGN_IN_HREF } from "@/lib/shell";

export default async function BookAppointmentPage() {
  if ((await getSession()) === null) {
    redirect(`${SIGN_IN_HREF}?next=${encodeURIComponent(BOOK_APPOINTMENT_HREF)}`);
  }
  return <BookingScreen clinics={await getClinics()} />;
}
