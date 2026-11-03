import { describe, expect, it } from "vitest";
import {
  BRAND_NAME,
  MAIN_NAV,
  PLACE_BET_HREF,
  WALLET_HREF,
  brandHref,
  isCurrent,
  signInTarget,
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

  it("shows only public entries to guests, Menu last for everyone", () => {
    expect(visibleNav(false).map((e) => e.key)).toEqual(["menu", "lobby"]);
    expect(visibleNav(true).at(-1)?.key).toBe("lobby");
    expect(MAIN_NAV.at(-1)).toEqual({ key: "lobby", label: "Lobby", href: "/lobby", public: true });
    expect(isCurrent(MAIN_NAV.at(-1)!, "/lobby")).toBe(true);
    expect(signInTarget("checkout")).toBe("/checkout");
    expect(visibleNav(true)).toEqual(MAIN_NAV);
    expect(MAIN_NAV[0]).toEqual({ key: "home", label: "Home", href: "/" });
    expect(visibleNav(true)[1]).toEqual({ key: "wallet", label: "Wallet", href: "/wallet" });
  });

  it("marks the current entry", () => {
    expect(isCurrent(MAIN_NAV[0], "/")).toBe(true);
    expect(isCurrent(MAIN_NAV[0], "/other")).toBe(false);
  });

  it("keeps Appointments before Menu; its booking page is current there too", () => {
    const appointments = MAIN_NAV.find((e) => e.key === "appointments")!;
    expect(appointments).toEqual({
      key: "appointments",
      label: "Appointments",
      href: "/appointments",
    });
    expect(isCurrent(appointments, "/appointments/book")).toBe(true);
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
      "menu",
      "onboarding-templates",
      "lobby",
    ]);
    expect(isCurrent(MAIN_NAV[2], "/orders")).toBe(true);
    expect(isCurrent(MAIN_NAV[0], "/orders")).toBe(false);
    expect(isCurrent(MAIN_NAV[2], "/")).toBe(false);
  });

  it("appends Templates after Menu, current on its nested routes, and a valid sign-in target", () => {
    expect(MAIN_NAV.find((e) => e.key === "onboarding-templates")).toEqual({
      key: "onboarding-templates",
      label: "Templates",
      href: "/onboarding-templates",
    });
    expect(isCurrent(MAIN_NAV.find((e) => e.key === "onboarding-templates")!, "/onboarding-templates/software-engineer")).toBe(true);
    expect(signInTarget("/onboarding-templates")).toBe("/onboarding-templates");
    expect(visibleNav(false).some((e) => e.key === "onboarding-templates")).toBe(false);
  });

  it("marks a section current on its nested routes", () => {
    const hires = { key: "hires", label: "New hires", href: "/new-hires" };
    expect(isCurrent(hires, "/new-hires/42")).toBe(true);
    expect(isCurrent(hires, "/new-hires-archive")).toBe(false);
  });
});
