import { describe, expect, it } from "vitest";
import { EMAIL_ERROR, PASSWORD_ERROR, validateEmail, validatePassword } from "./credentials";

describe("credentials", () => {
  it("accepts an email shape, ignoring surrounding spaces", () => {
    expect(validateEmail(" name@example.com ")).toBeNull();
  });

  it("AC10: refuses non-standard addresses", () => {
    for (const bad of ["nope", "", "a@b", "a@@b.co", "a b@c.de", "a@b.c", "@b.co"]) {
      expect(validateEmail(bad)).toBe(EMAIL_ERROR);
    }
    expect(EMAIL_ERROR).toBe("Enter an email like name@example.com.");
  });

  it("AC8/AC9: requires 8 characters", () => {
    expect(validatePassword("abc1234")).toBe("Password must be at least 8 characters.");
    expect(PASSWORD_ERROR).toBe("Password must be at least 8 characters.");
    expect(validatePassword("abcd1234")).toBeNull();
  });
});
