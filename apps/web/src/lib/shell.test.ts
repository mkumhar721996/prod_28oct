import { describe, expect, it } from "vitest";
import { BRAND_NAME, MAIN_NAV, brandHref, isCurrent, visibleNav } from "./shell";

describe("shell", () => {
  it("has one brand value", () => {
    expect(BRAND_NAME).toBe("Web App");
  });

  it("brand targets home when signed in and sign-in when signed out", () => {
    expect(brandHref(true)).toBe("/");
    expect(brandHref(false)).toBe("/sign-in");
  });

  it("shows nav only when signed in", () => {
    expect(visibleNav(false)).toEqual([]);
    expect(visibleNav(false, "hr")).toEqual([]);
    expect(visibleNav(true, "hr")).toEqual(MAIN_NAV);
    expect(MAIN_NAV[0]).toEqual({ key: "home", label: "Home", href: "/" });
  });

  it("shows HR entries to hr", () => {
    expect(visibleNav(true, "hr").map((e) => e.label)).toEqual(
      expect.arrayContaining(["New hires", "Holidays"]),
    );
  });

  it("hides HR entries from other or missing roles", () => {
    expect(visibleNav(true, null).map((e) => e.key)).toEqual(["home"]);
    expect(visibleNav(true).map((e) => e.key)).toEqual(["home"]);
    expect(visibleNav(true, "new_hire").map((e) => e.key)).toEqual(["home"]);
  });

  it("orders New hires before Holidays", () => {
    const keys = visibleNav(true, "hr").map((e) => e.key);
    expect(keys.indexOf("new-hires")).toBeLessThan(keys.indexOf("holidays"));
  });

  it("marks the current entry", () => {
    expect(isCurrent(MAIN_NAV[0], "/")).toBe(true);
    expect(isCurrent(MAIN_NAV[0], "/other")).toBe(false);
  });

  it("marks a section current on its nested routes", () => {
    const hires = { key: "hires", label: "New hires", href: "/new-hires" };
    expect(isCurrent(hires, "/new-hires/42")).toBe(true);
    expect(isCurrent(hires, "/new-hires-archive")).toBe(false);
  });
});
