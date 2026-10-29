import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/appointments", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/appointments")>()),
  bookAppointment: vi.fn(),
  fetchSlots: vi.fn(),
}));

import type { Clinic, SlotDay } from "@/lib/appointments";
import { BookingScreen, runConfirm } from "./BookingScreen";

const clinics: Clinic[] = [
  { id: "central", name: "Central Clinic", hoursText: "Open Monday to Friday, 09:00 to 11:00" },
  { id: "north", name: "North Clinic", hoursText: "Open Mondays, 09:00 to 12:00" },
  { id: "riverside", name: "Riverside Clinic", hoursText: "Open Tuesdays and Thursdays" },
];
const days: SlotDay[] = [{ date: "2026-11-02", times: ["09:00", "09:30"] }];
const slot = { date: "2026-11-02", time: "09:00" };
const render = (initial?: React.ComponentProps<typeof BookingScreen>["initial"]) =>
  renderToStaticMarkup(<BookingScreen clinics={clinics} initial={initial} />);
const confirmButton = (html: string) => html.match(/<button[^>]*>(?:Confirm|Booking…)<\/button>/)![0];

describe("BookingScreen markup", () => {
  it("offers 'Choose clinic' plus the fixed clinics", () => {
    const html = render();
    const options = [...html.matchAll(/<option[^>]*>([^<]*)<\/option>/g)].map((m) => m[1]);
    expect(options).toEqual(["Choose clinic", "Central Clinic", "North Clinic", "Riverside Clinic"]);
    expect(html).toContain("<h1>Book appointment</h1>");
    expect(html).toContain("Choose a clinic to see free times.");
  });

  it("shows the chosen clinic's hours", () => {
    expect(render({ clinicId: "north" })).toContain("Open Mondays, 09:00 to 12:00");
  });

  it("disables Confirm with a clinic but no slot", () => {
    expect(confirmButton(render({ clinicId: "north", days }))).toContain('disabled=""');
  });

  it("enables Confirm with a clinic and slot, without a reason", () => {
    const html = render({ clinicId: "north", days, slot });
    expect(confirmButton(html)).not.toContain('disabled=""');
    expect(html).toMatch(/aria-pressed="true"[^>]*>09:00</);
    expect(html).toMatch(/aria-pressed="false"[^>]*>09:30</);
  });

  it("enables Confirm at 500 characters and shows no error", () => {
    const html = render({ clinicId: "north", days, slot, reason: "a".repeat(500) });
    expect(confirmButton(html)).not.toContain('disabled=""');
    expect(html).not.toContain("Shorten it");
    expect(html).toContain("500 / 500");
  });

  it("disables Confirm at 501 characters and explains the limit", () => {
    const html = render({ clinicId: "north", days, slot, reason: "a".repeat(501) });
    expect(confirmButton(html)).toContain('disabled=""');
    expect(html).toContain("Reason is 501 characters. Shorten it to 500 or fewer.");
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain("is-invalid");
  });

  it("shows a pending Confirm and disables Cancel", () => {
    const html = render({ clinicId: "north", days, slot, pending: true });
    expect(confirmButton(html)).toContain("Booking…");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Cancel</);
  });

  it("shows a warning alert without a toast", () => {
    const html = render({
      clinicId: "north",
      days,
      alert: { kind: "warning", title: "That time is no longer available", text: "Pick another time." },
    });
    expect(html).toContain('role="alert"');
    expect(html).toContain("alert-warning");
    expect(html).toContain("no longer available");
    expect(html).not.toContain("Appointment booked");
  });

  it("keeps clinic, slot and reason after a generic failure", () => {
    const html = render({
      clinicId: "north",
      days,
      slot,
      reason: "Check-up",
      alert: { kind: "danger", title: "We couldn't book your appointment", text: "Try again." },
    });
    expect(html).toContain("alert-danger");
    expect(html).toContain("We couldn&#x27;t book your appointment");
    expect(html).toMatch(/<option value="north" selected/);
    expect(html).toMatch(/aria-pressed="true"[^>]*>09:00</);
    expect(html).toContain("Check-up");
    expect(confirmButton(html)).not.toContain('disabled=""');
  });
});

describe("runConfirm", () => {
  const input = { clinicId: "north", ...slot, reason: "" };
  const deps = (result: unknown, fresh: SlotDay[] | Error = days) => ({
    bookAppointment: vi.fn(async () => result),
    fetchSlots: vi.fn(async () => {
      if (fresh instanceof Error) throw fresh;
      return fresh;
    }),
  });

  it.each(["", "Blood pressure check"])("is booked with reason %j", async (reason) => {
    const d = deps({ ok: true });
    expect(await runConfirm(d as never, { ...input, reason })).toEqual({ type: "booked" });
    expect(d.bookAppointment).toHaveBeenCalledWith({ ...input, reason });
    expect(d.fetchSlots).not.toHaveBeenCalled();
  });

  it("refetches slots when the slot was taken", async () => {
    const fresh = [{ date: "2026-11-02", times: ["09:30"] }];
    const d = deps({ ok: false, kind: "slot_taken", message: "no longer available" }, fresh);
    const outcome = await runConfirm(d as never, input);
    expect(outcome).toMatchObject({ type: "slot_taken", days: fresh });
    expect(outcome).toMatchObject({ alert: { kind: "warning", text: "no longer available" } });
    expect(d.fetchSlots).toHaveBeenCalledWith("north");
  });

  it("still reports a taken slot when the refetch fails", async () => {
    const d = deps({ ok: false, kind: "slot_taken", message: "m" }, new Error("offline"));
    expect(await runConfirm(d as never, input)).toMatchObject({ type: "slot_taken", days: null });
  });

  it("warns about an existing booking at that time", async () => {
    const message = "You already have an appointment at this time. Pick a different time.";
    const d = deps({ ok: false, kind: "already_booked", message });
    expect(await runConfirm(d as never, input)).toMatchObject({
      type: "already_booked",
      alert: { kind: "warning", text: message },
    });
  });

  it("reports a generic failure as an inline danger alert", async () => {
    const d = deps({ ok: false, kind: "error", message: "Try again." });
    expect(await runConfirm(d as never, input)).toMatchObject({
      type: "error",
      alert: { kind: "danger", title: "We couldn't book your appointment" },
    });
    expect(d.fetchSlots).not.toHaveBeenCalled();
  });
});
