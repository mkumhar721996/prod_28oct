import type { ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// No DOM here: stub the hooks so the component can be called as a plain function and its tree walked.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useState: (v: unknown) => [v, () => {}],
  useRef: () => ({ current: null }),
  useEffect: () => {},
}));

import type { Appointment } from "@/lib/appointments";
import { AppointmentDetail } from "./AppointmentDetail";

const booking: Appointment = {
  id: "a1",
  clinicId: "north",
  clinicName: "North Clinic",
  timeZone: "Europe/London",
  date: "2026-11-03",
  time: "09:30",
  startsAt: "2026-11-03T09:30:00.000Z",
  reason: "Blood pressure check",
};
const render = (a: Appointment = booking, upcoming = true) =>
  renderToStaticMarkup(<AppointmentDetail appointment={a} upcoming={upcoming} onBack={() => {}} />);

describe("AppointmentDetail", () => {
  it("shows the clinic name", () => {
    expect(render()).toMatch(/<h2[^>]*class="d-value"[^>]*>North Clinic<\/h2>/);
  });

  it("shows the clinic-local date and time", () => {
    expect(render()).toContain("Tue 3 Nov 2026, 09:30 GMT");
  });

  it("shows the reason, or 'No reason given' in the muted style", () => {
    expect(render()).toContain("Blood pressure check");
    expect(render({ ...booking, reason: "" })).toMatch(/class="d-value d-reason is-empty"[^>]*>No reason given</);
  });

  it("names the details card for assistive technology", () => {
    expect(render()).toMatch(/role="region"[^>]*aria-labelledby="detail-title"|aria-labelledby="detail-title"[^>]*role="region"/);
  });

  it("labels it Upcoming or Past", () => {
    expect(render()).toMatch(/class="badge"[^>]*>Upcoming</);
    expect(render(booking, false)).toMatch(/class="badge"[^>]*>Past</);
  });

  it("offers no reschedule or cancel, only Back", () => {
    const html = render();
    expect(html).not.toMatch(/reschedule|cancel/i);
    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html).toContain("Back to Appointments");
  });

  it("calls onBack from the Back button", () => {
    const onBack = vi.fn();
    type El = ReactElement<{ onClick?: () => void; children?: ReactNode }>;
    const findButton = (n: ReactNode): El | null => {
      if (!n || typeof n !== "object") return null;
      if (Array.isArray(n)) return n.map(findButton).find(Boolean) ?? null;
      const el = n as El;
      return el.type === "button" ? el : findButton(el.props.children);
    };
    const back = findButton(AppointmentDetail({ appointment: booking, upcoming: true, onBack }));
    back!.props.onClick!();
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
