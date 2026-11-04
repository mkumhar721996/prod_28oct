import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/staffAccounts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/staffAccounts")>()),
  searchAccounts: vi.fn(() => new Promise(() => undefined)),
}));

import { AccountsScreen } from "./AccountsScreen";

describe("AccountsScreen", () => {
  it("shows the labelled search and a busy skeleton while loading", () => {
    const html = renderToStaticMarkup(<AccountsScreen />);
    expect(html).toContain("<h1>Accounts</h1>");
    expect(html).toMatch(/<label for="find-account">Find an account<\/label>/);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("skeleton");
    expect(html).not.toContain("Freeze account");
  });
});
