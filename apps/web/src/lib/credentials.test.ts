import { describe, expect, it } from "vitest";
import { EMAIL_ERROR, PASSWORD_ERROR, validateEmail, validateName, validatePassword } from "./credentials";

describe("credentials", () => {
  it("accepts an email shape, ignoring surrounding spaces", () => {
    expect(validateEmail(" name@example.com ")).toBeNull();
  });

  it("explains a bad email", () => {
    expect(validateEmail("name")).toBe(EMAIL_ERROR);
    expect(validateEmail("")).toBe("Enter an email like name@example.com");
  });

  it("requires 8 characters", () => {
    expect(validatePassword("1234567")).toBe(PASSWORD_ERROR);
    expect(PASSWORD_ERROR).toBe("Use at least 8 characters");
    expect(validatePassword("12345678")).toBeNull();
  });

  it("requires a name of 1 to 50 characters, ignoring surrounding spaces", () => {
    expect(validateName("  ")).toBe("Enter your name");
    expect(validateName("x".repeat(50))).toBeNull();
    expect(validateName("x".repeat(51))).toBe("Use 50 characters or fewer");
  });
});
