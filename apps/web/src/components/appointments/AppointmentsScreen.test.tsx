import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const replace = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

import type { Appointment } from "@/lib/appointments";
import { AppointmentsScreen } from "./AppointmentsScreen";
import { TOAST_MS } from "./Toast";

const NOW = "2026-10-29T10:00:00.000Z";
const booking: Appointment = {
  id: "a1",
  clinicId: "north",
  clinicName: "North Clinic",
  date: "2026-11-02",
  time: "09:00",
  startsAt: "2026-11-02T09:00:00.000Z",
  reason: "Blood pressure check",
};
const render = (props: Partial<React.ComponentProps<typeof AppointmentsScreen>>) =>
  renderToStaticMarkup(<AppointmentsScreen appointments={[]} now={NOW} {...props} />);

describe("AppointmentsScreen", () => {
  it("lists the new booking with a link to book another", () => {
    const html = render({ appointments: [booking] });
    expect(html).toContain("North Clinic, Mon 2 Nov, 09:00 — Blood pressure check");
    expect(html).toMatch(/<a[^>]*href="\/appointments\/book"[^>]*>Book appointment<\/a>/);
    expect(html).not.toContain("No upcoming appointments");
  });

  it("shows the none-booked state with the same link", () => {
    const html = render({});
    const empty = html.slice(html.indexOf("No upcoming appointments"));
    expect(empty).toContain("Pick a clinic and a time that suits you.");
    expect(empty).toMatch(/<a[^>]*href="\/appointments\/book"[^>]*>Book appointment<\/a>/);
  });

  it("has Upcoming and Past tabs; past bookings are under Past", () => {
    const past = { ...booking, startsAt: "2026-10-01T09:00:00.000Z", date: "2026-10-01" };
    const html = render({ appointments: [past] });
    expect(html).toMatch(/role="tab"[^>]*aria-selected="true"[^>]*>Upcoming</);
    expect(html).not.toContain("North Clinic, Thu 1 Oct");
    expect(render({ appointments: [past], initialTab: "past" })).toContain("North Clinic, Thu 1 Oct, 09:00");
  });

  it("shows the Appointment booked toast only after a booking", () => {
    const html = render({ appointments: [booking], justBooked: true });
    expect(html).toMatch(/role="status"/);
    expect(html).toContain("Appointment booked");
    expect(render({ appointments: [booking] })).not.toContain("Appointment booked");
  });

  it("auto-hides the toast after four seconds", () => {
    expect(TOAST_MS).toBe(4000);
  });
});
