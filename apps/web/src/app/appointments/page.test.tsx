import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSession, getAppointments, redirect } = vi.hoisted(() => ({
  getSession: vi.fn(),
  getAppointments: vi.fn(async () => []),
  redirect: vi.fn((href: string): never => {
    throw new Error(`redirect:${href}`);
  }),
}));
vi.mock("@/lib/session", () => ({ getSession }));
vi.mock("@/lib/appointments", () => ({ getAppointments }));
vi.mock("next/navigation", () => ({ redirect }));

import { AppointmentsScreen } from "@/components/appointments/AppointmentsScreen";
import AppointmentsPage from "./page";

beforeEach(() => vi.clearAllMocks());

describe("AppointmentsPage", () => {
  it("sends a signed-out visitor to sign-in without loading appointments", async () => {
    getSession.mockResolvedValue(null);
    await expect(AppointmentsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      "redirect:/sign-in?next=%2Fappointments",
    );
    expect(getAppointments).not.toHaveBeenCalled();
  });

  it("renders the screen, flagging a just-made booking from ?booked=1", async () => {
    getSession.mockResolvedValue({ role: "player" });
    const el = await AppointmentsPage({ searchParams: Promise.resolve({ booked: "1" }) });
    expect(el.type).toBe(AppointmentsScreen);
    expect(el.props.justBooked).toBe(true);
    const plain = await AppointmentsPage({ searchParams: Promise.resolve({}) });
    expect(plain.props.justBooked).toBe(false);
  });
});
