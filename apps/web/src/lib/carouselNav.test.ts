import { describe, expect, it } from "vitest";
import { nextIndex, prevIndex, showsControls } from "./carouselNav";

describe("carouselNav", () => {
  it("moves to the next slide (AC2)", () => expect(nextIndex(0, 3)).toBe(1));
  it("moves to the previous slide (AC3)", () => expect(prevIndex(1, 3)).toBe(0));
  it("wraps from last to first (AC5)", () => expect(nextIndex(2, 3)).toBe(0));
  it("wraps from first to last (AC6)", () => expect(prevIndex(0, 3)).toBe(2));
  it("stays at 0 for zero or one slide", () => {
    expect(nextIndex(0, 0)).toBe(0);
    expect(prevIndex(0, 1)).toBe(0);
  });
  it("shows controls only for more than one slide (AC8)", () => {
    expect(showsControls(0)).toBe(false);
    expect(showsControls(1)).toBe(false);
    expect(showsControls(3)).toBe(true);
  });
});
