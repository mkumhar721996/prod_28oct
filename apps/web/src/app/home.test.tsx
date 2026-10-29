import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSession, getAppointments } = vi.hoisted(() => ({
  getSession: vi.fn(),
  getAppointments: vi.fn(),
}));
vi.mock("@/lib/session", () => ({ getSession }));
vi.mock("@/lib/appointments", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/appointments")>()),
  getAppointments,
}));

import Home from "./page";

beforeEach(() => vi.clearAllMocks());

describe("Home", () => {
  it("shows no appointment card to a signed-out visitor", async () => {
    getSession.mockResolvedValue(null);
    const html = renderToStaticMarkup(await Home());
    expect(html).not.toContain("Next appointment");
    expect(getAppointments).not.toHaveBeenCalled();
  });

  it("offers booking from the next-appointment card when nothing is booked", async () => {
    getSession.mockResolvedValue({ role: "player" });
    getAppointments.mockResolvedValue([]);
    const html = renderToStaticMarkup(await Home());
    expect(html).toContain("Next appointment");
    expect(html).toContain("Nothing booked yet");
    expect(html).toMatch(/<a[^>]*href="\/appointments\/book"[^>]*>Book appointment<\/a>/);
  });

  it("shows the soonest upcoming booking", async () => {
    getSession.mockResolvedValue({ role: "player" });
    getAppointments.mockResolvedValue([
      {
        id: "a",
        clinicId: "central",
        clinicName: "Central Clinic",
        date: "2999-11-03",
        time: "09:30",
        startsAt: "2999-11-03T09:30:00.000Z",
        reason: "",
      },
    ]);
    expect(renderToStaticMarkup(await Home())).toContain("Central Clinic");
  });
});
