import { describe, expect, it } from "vitest";
import { validateHire } from "./validate";

const valid = { name: "Ada", email: "ada@example.com", role: "Engineer", startDate: "2026-11-02" };

describe("validateHire", () => {
  it("returns no errors for a valid hire", () => {
    expect(validateHire(valid)).toEqual({});
  });

  it("flags a missing name only", () => {
    expect(validateHire({ ...valid, name: "" })).toEqual({ name: "Enter the new hire’s full name." });
  });

  it("flags every missing field at once", () => {
    expect(validateHire({ name: "", email: "", role: "", startDate: "" })).toEqual({
      name: "Enter the new hire’s full name.",
      email: "Enter a work email like name@example.com.",
      role: "Choose a role.",
      startDate: "Choose a start date.",
    });
  });

  it("treats whitespace-only values as missing", () => {
    expect(validateHire({ ...valid, name: "   ", email: "  " })).toEqual({
      name: "Enter the new hire’s full name.",
      email: "Enter a work email like name@example.com.",
    });
  });

  it.each(["a@b", "a b@c.co", "a@@b.co", "@b.co", "a@.co", "ada@example", "not-an-email"])(
    "rejects email %s",
    (email) => {
      expect(validateHire({ ...valid, email }).email).toBe("Enter an email like name@example.com.");
    },
  );

  it.each(["ada+x@example.com", "a.b@sub.example.co", "  ada@example.com  "])(
    "accepts email %s",
    (email) => {
      expect(validateHire({ ...valid, email }).email).toBeUndefined();
    },
  );
});
