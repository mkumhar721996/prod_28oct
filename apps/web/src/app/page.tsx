import { describeNext, getAppointments } from "@/lib/appointments";
import { getSession } from "@/lib/session";
import { BOOK_APPOINTMENT_HREF } from "@/lib/shell";
import { appTitle } from "@/lib/title";

export default async function Home() {
  const signedIn = (await getSession()) !== null;
  const next = signedIn ? describeNext(await getAppointments(), new Date()) : null;
  return (
    <div className="stack stack-4">
      <h1 className="text-3xl font-semibold">{appTitle()}</h1>
      {signedIn && (
        <div className="card stack stack-2" aria-labelledby="next-appointment">
          <h2 id="next-appointment">Next appointment</h2>
          <p>{next ?? "Nothing booked yet"}</p>
          <div>
            <a className="btn btn-primary" href={BOOK_APPOINTMENT_HREF}>
              Book appointment
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
