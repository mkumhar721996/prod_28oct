import { afterEach, describe, expect, it, vi } from "vitest";
import {
  REASON_MAX,
  bookAppointment,
  canConfirm,
  describeAppointment,
  describeDateTime,
  describeNext,
  dayLabel,
  NO_REASON_TEXT,
  reasonText,
  zoneNote,
  fetchSlots,
  reasonError,
  splitUpcoming,
} from "./appointments";

const slot = { date: "2026-11-02", time: "09:00" };

describe("canConfirm", () => {
  it("needs a clinic and a slot", () => {
    expect(canConfirm({ clinicId: "north", slot: null, reasonLength: 0 })).toBe(false);
    expect(canConfirm({ clinicId: "", slot, reasonLength: 0 })).toBe(false);
    expect(canConfirm({ clinicId: "north", slot, reasonLength: 0 })).toBe(true);
  });

  it("allows a reason of 500 characters and not 501", () => {
    expect(REASON_MAX).toBe(500);
    expect(canConfirm({ clinicId: "north", slot, reasonLength: 500 })).toBe(true);
    expect(canConfirm({ clinicId: "north", slot, reasonLength: 501 })).toBe(false);
  });
});

describe("reasonError", () => {
  it("is null up to 500 and a message above", () => {
    expect(reasonError(500)).toBeNull();
    expect(reasonError(501)).toBe("Reason is 501 characters. Shorten it to 500 or fewer.");
  });
});

describe("formatting", () => {
  it("labels days and describes bookings", () => {
    expect(dayLabel("2026-11-02")).toBe("Mon 2 Nov");
    const base = { id: "a", clinicId: "north", clinicName: "North Clinic", timeZone: "Europe/London", date: "2026-11-02", time: "09:00", startsAt: "2026-11-02T09:00:00.000Z" };
    expect(describeAppointment({ ...base, reason: "" })).toBe("North Clinic, Mon 2 Nov, 09:00");
    expect(describeAppointment({ ...base, reason: "x".repeat(80) })).toBe("North Clinic, Mon 2 Nov, 09:00");
  });

  it("orders upcoming soonest first and past most recent first, around now", () => {
    const mk = (startsAt: string) => ({ id: startsAt, clinicId: "", clinicName: "", timeZone: "", date: "", time: "", reason: "", startsAt });
    const input = [
      mk("2026-11-20T08:00:00Z"),
      mk("2026-10-29T15:00:00Z"),
      mk("2026-10-01T09:00:00Z"),
      mk("2026-10-29T08:00:00Z"),
    ];
    const { upcoming, past } = splitUpcoming(input, new Date("2026-10-29T10:00:00Z"));
    expect(upcoming.map((a) => a.startsAt)).toEqual(["2026-10-29T15:00:00Z", "2026-11-20T08:00:00Z"]);
    expect(past.map((a) => a.startsAt)).toEqual(["2026-10-29T08:00:00Z", "2026-10-01T09:00:00Z"]);
    expect(input[0].startsAt).toBe("2026-11-20T08:00:00Z");
  });

  it("splits upcoming from past by start instant", () => {
    const mk = (startsAt: string) => ({ id: startsAt, clinicId: "", clinicName: "", timeZone: "", date: "", time: "", reason: "", startsAt });
    const { upcoming, past } = splitUpcoming(
      [mk("2026-11-01T09:00:00Z"), mk("2026-10-01T09:00:00Z")],
      new Date("2026-10-29T00:00:00Z"),
    );
    expect(upcoming.map((a) => a.startsAt)).toEqual(["2026-11-01T09:00:00Z"]);
    expect(past.map((a) => a.startsAt)).toEqual(["2026-10-01T09:00:00Z"]);
  });
});

describe("describeNext", () => {
  const mk = (startsAt: string, date: string, time: string) => ({
    id: startsAt,
    clinicId: "central",
    clinicName: "Central Clinic",
    timeZone: "Europe/London",
    date,
    time,
    reason: "",
    startsAt,
  });
  it("describes the soonest upcoming booking, or null", () => {
    const now = new Date("2026-10-29T00:00:00Z");
    expect(describeNext([mk("2026-10-01T09:00:00Z", "2026-10-01", "09:00")], now)).toBeNull();
    expect(describeNext([], now)).toBeNull();
    expect(
      describeNext(
        [mk("2026-11-03T09:30:00Z", "2026-11-03", "09:30"), mk("2026-11-20T08:00:00Z", "2026-11-20", "08:00")],
        now,
      ),
    ).toBe("Tue 3 Nov, 09:30 at Central Clinic");
  });
});

describe("client calls", () => {
  afterEach(() => vi.unstubAllGlobals());
  const reply = (status: number, body: unknown) =>
    vi.fn(async () => ({ ok: status < 400, status, json: async () => body }));

  it("books and returns ok", async () => {
    const fetchMock = reply(201, { appointment: {} });
    vi.stubGlobal("fetch", fetchMock);
    expect(await bookAppointment({ clinicId: "north", ...slot, reason: "" })).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/appointments",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  it.each([
    ["slot_taken", "slot_taken"],
    ["already_booked", "already_booked"],
    ["not_offered", "error"],
  ])("maps a 409/400 with code %s to kind %s", async (code, kind) => {
    vi.stubGlobal("fetch", reply(code === "not_offered" ? 400 : 409, { code, message: "Server says" }));
    expect(await bookAppointment({ clinicId: "north", ...slot, reason: "" })).toEqual({
      ok: false,
      kind,
      message: kind === "error" ? "We couldn't book your appointment. Try again." : "Server says",
    });
  });

  it("never throws: a 500 or network failure is a generic error", async () => {
    vi.stubGlobal("fetch", reply(500, {}));
    expect(await bookAppointment({ clinicId: "north", ...slot, reason: "" })).toMatchObject({ ok: false, kind: "error" });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect(await bookAppointment({ clinicId: "north", ...slot, reason: "" })).toMatchObject({ ok: false, kind: "error" });
  });

  it("fetches slots for a clinic and rejects on failure", async () => {
    vi.stubGlobal("fetch", reply(200, [{ date: "2026-11-02", times: ["09:00"] }]));
    expect(await fetchSlots("north")).toEqual([{ date: "2026-11-02", times: ["09:00"] }]);
    vi.stubGlobal("fetch", reply(500, {}));
    await expect(fetchSlots("north")).rejects.toThrow();
  });
});

describe("appointment detail helpers", () => {
  const appt = {
    id: "a1",
    clinicId: "north",
    clinicName: "North Clinic",
    timeZone: "Europe/London",
    date: "2026-11-03",
    time: "09:30",
    startsAt: "2026-11-03T09:30:00.000Z",
    reason: "Blood pressure check",
  };
  const ny = { ...appt, timeZone: "America/New_York", date: "2026-11-24", time: "10:00", startsAt: "2026-11-24T15:00:00.000Z" };

  it("describes the clinic-local date and time with the zone name", () => {
    expect(describeDateTime(appt)).toBe("Tue 3 Nov 2026, 09:30 GMT");
    expect(describeDateTime(ny)).toBe("Tue 24 Nov 2026, 10:00 GMT-5");
  });

  it("omits the zone name when the zone is missing or invalid", () => {
    expect(describeDateTime({ ...appt, timeZone: "Not/AZone" })).toBe("Tue 3 Nov 2026, 09:30");
  });

  it("shows the reason, or 'No reason given' when empty or blank", () => {
    expect(reasonText(appt)).toBe("Blood pressure check");
    expect(NO_REASON_TEXT).toBe("No reason given");
    expect(reasonText({ ...appt, reason: "" })).toBe("No reason given");
    expect(reasonText({ ...appt, reason: "   " })).toBe("No reason given");
  });

  it("notes the clinic zone only when the device zone differs", () => {
    expect(zoneNote(ny, "Europe/London")).toContain("clinic's local time");
    expect(zoneNote(ny, "Europe/London")).toBe(
      "Shown in Eastern Standard Time, the clinic's local time. Your device is on Greenwich Mean Time.",
    );
    expect(zoneNote(appt, "Europe/London")).toBeNull();
  });

  it("gives no note for alias IDs of the same zone, or no zone note for an unknown zone", () => {
    const kolkata = { ...appt, timeZone: "Asia/Kolkata" };
    expect(zoneNote(kolkata, "Asia/Calcutta")).toBeNull();
    expect(zoneNote({ ...appt, timeZone: "Not/AZone" }, "Europe/London")).toBeNull();
  });
});
