import { describe, expect, it } from "vitest";
import {
  BRAND_NAME,
  MAIN_NAV,
  PLACE_BET_HREF,
  WALLET_HREF,
  brandHref,
  isCurrent,
  visibleNav,
} from "./shell";

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
    expect(visibleNav(true)).toEqual(MAIN_NAV);
    expect(MAIN_NAV[0]).toEqual({ key: "home", label: "Home", href: "/" });
    expect(visibleNav(true)[1]).toEqual({ key: "wallet", label: "Wallet", href: "/wallet" });
  });

  it("marks the current entry", () => {
    expect(isCurrent(MAIN_NAV[0], "/")).toBe(true);
    expect(isCurrent(MAIN_NAV[0], "/other")).toBe(false);
  });

  it("appends Appointments at the end; its booking page is current there too", () => {
    expect(MAIN_NAV.at(-1)).toEqual({
      key: "appointments",
      label: "Appointments",
      href: "/appointments",
    });
    expect(isCurrent(MAIN_NAV.at(-1)!, "/appointments/book")).toBe(true);
  });

  it("keeps History before Appointments and points Place a bet at the wallet for now", () => {
    expect(MAIN_NAV[3]).toEqual({ key: "history", label: "History", href: "/history" });
    expect(isCurrent(MAIN_NAV[3], "/history")).toBe(true);
    expect(PLACE_BET_HREF).toBe(WALLET_HREF);
  });

  it("appends Orders after Home", () => {
    expect(MAIN_NAV.map((e) => e.key)).toEqual([
      "home",
      "wallet",
      "orders",
      "history",
      "appointments",
    ]);
    expect(isCurrent(MAIN_NAV[2], "/orders")).toBe(true);
    expect(isCurrent(MAIN_NAV[0], "/orders")).toBe(false);
    expect(isCurrent(MAIN_NAV[2], "/")).toBe(false);
  });

  it("marks a section current on its nested routes", () => {
    const hires = { key: "hires", label: "New hires", href: "/new-hires" };
    expect(isCurrent(hires, "/new-hires/42")).toBe(true);
    expect(isCurrent(hires, "/new-hires-archive")).toBe(false);
  });
});
