import { describe, expect, it } from "vitest";
import { appTitle } from "./title";

describe("appTitle", () => {
  it("returns the welcome heading", () => {
    expect(appTitle()).toBe("Welcome to the Web App");
  });
});
