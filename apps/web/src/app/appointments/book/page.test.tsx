import { beforeEach, describe, expect, it, vi } from "vitest";

const clinics = [{ id: "north", name: "North Clinic", hoursText: "Open Mondays" }];
const { getSession, getClinics, redirect } = vi.hoisted(() => ({
  getSession: vi.fn(),
  getClinics: vi.fn(async () => clinics),
  redirect: vi.fn((href: string): never => {
    throw new Error(`redirect:${href}`);
  }),
}));
vi.mock("@/lib/session", () => ({ getSession }));
vi.mock("@/lib/appointments", () => ({ getClinics }));
vi.mock("next/navigation", () => ({ redirect }));

import { BookingScreen } from "@/components/appointments/BookingScreen";
import BookAppointmentPage from "./page";

beforeEach(() => vi.clearAllMocks());

describe("BookAppointmentPage", () => {
  it("sends a signed-out visitor to sign-in, returning to the booking page", async () => {
    getSession.mockResolvedValue(null);
    await expect(BookAppointmentPage()).rejects.toThrow(
      "redirect:/sign-in?next=%2Fappointments%2Fbook",
    );
    expect(getClinics).not.toHaveBeenCalled();
  });

  it("renders the booking screen with the clinic list for a signed-in patient", async () => {
    getSession.mockResolvedValue({ role: "player" });
    const el = await BookAppointmentPage();
    expect(el.type).toBe(BookingScreen);
    expect(el.props.clinics).toEqual(clinics);
  });
});
