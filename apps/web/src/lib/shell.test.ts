import { describe, expect, it, vi } from "vitest";
import {
  BRAND_NAME,
  MAIN_NAV,
  brandHref,
  isCurrent,
  runSignOut,
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
  });

  it("marks the current entry", () => {
    expect(isCurrent(MAIN_NAV[0], "/")).toBe(true);
    expect(isCurrent(MAIN_NAV[0], "/other")).toBe(false);
  });
});

describe("runSignOut", () => {
  it("calls onSuccess and reports ok when sign out resolves", async () => {
    const onSuccess = vi.fn();
    await expect(runSignOut(() => Promise.resolve(), onSuccess)).resolves.toBe(true);
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it("does not call onSuccess and reports failure when sign out rejects", async () => {
    const onSuccess = vi.fn();
    await expect(runSignOut(() => Promise.reject(new Error("x")), onSuccess)).resolves.toBe(false);
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
