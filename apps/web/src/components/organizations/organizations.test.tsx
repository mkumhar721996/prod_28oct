import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Role } from "@/lib/orgSession";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/orgSession", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/orgSession")>()),
  checkSession: vi.fn(),
  signOutUser: vi.fn(),
}));

import { handleCreateAccount, NewAccountForm, ROLE_OPTIONS } from "./NewAccountForm";
import { OrganizationScreen, removeOrganization, saveDraft } from "./OrganizationScreen";
import { OrganizationsScreen } from "./OrganizationsScreen";

const org = { id: "o1", name: "Acme Giving", address: "1 High St" };
const userOf = (role: Role) => ({ email: `${role}@org.example`, role });
const nonAdmins: Role[] = ["staff", "fundraising_consultant"];

describe("OrganizationScreen", () => {
  it.each(nonAdmins)("AC4/AC5/AC6: %s sees the details and Edit, but no delete action", (role) => {
    const html = renderToStaticMarkup(<OrganizationScreen user={userOf(role)} organization={org} />);
    expect(html).toContain("Acme Giving");
    expect(html).toContain("1 High St");
    expect(html).toContain("Edit organization");
    expect(html.toLowerCase()).not.toContain("delete");
  });

  it("AC7: a super-admin sees Delete organization", () => {
    const html = renderToStaticMarkup(
      <OrganizationScreen user={userOf("super_admin")} organization={org} />,
    );
    expect(html).toContain("Delete organization");
  });

  it("AC12: a fresh mount shows the saved details and the code never stores a draft", () => {
    const html = renderToStaticMarkup(<OrganizationScreen user={userOf("staff")} organization={org} />);
    expect(html).toContain("Acme Giving");
    const source = readFileSync(`${__dirname}/OrganizationScreen.tsx`, "utf8");
    expect(source).not.toMatch(/localStorage|sessionStorage|document\.cookie/);
  });
});

describe("saveDraft", () => {
  it("AC5: saves the trimmed edit", async () => {
    const saveOrganization = vi.fn(async () => ({
      ok: true as const,
      value: { ...org, name: "Acme Giving Ltd" },
    }));
    const result = await saveDraft({ saveOrganization }, "o1", { name: " Acme Giving Ltd ", address: "1 High St" });
    expect(saveOrganization).toHaveBeenCalledWith("o1", { name: "Acme Giving Ltd", address: "1 High St" });
    expect(result).toMatchObject({ kind: "done" });
  });

  it("refuses a blank name without calling the API", async () => {
    const saveOrganization = vi.fn();
    expect(await saveDraft({ saveOrganization }, "o1", { name: "  ", address: "" })).toEqual({
      kind: "invalid",
      error: "Enter a name",
    });
    expect(saveOrganization).not.toHaveBeenCalled();
  });

  it("AC11: a 401 means the session ended", async () => {
    const saveOrganization = vi.fn(async () => ({ ok: false as const, status: 401, message: "x" }));
    expect(await saveDraft({ saveOrganization }, "o1", { name: "A", address: "" })).toEqual({ kind: "ended" });
    const deleteOrganization = vi.fn(async () => ({ ok: false as const, status: 401, message: "x" }));
    expect(await removeOrganization({ deleteOrganization }, "o1")).toEqual({ kind: "ended" });
  });
});

describe("OrganizationsScreen", () => {
  it.each(nonAdmins)("AC8: %s is offered no way to create an account", (role) => {
    const html = renderToStaticMarkup(
      <OrganizationsScreen user={userOf(role)} organizations={[{ id: "o1", name: "Acme Giving" }]} />,
    );
    expect(html).toContain("Acme Giving");
    expect(html).not.toContain("/accounts/new");
    expect(html).not.toContain("Manage accounts");
  });

  it("a super-admin sees the accounts link; an empty list explains itself", () => {
    const html = renderToStaticMarkup(<OrganizationsScreen user={userOf("super_admin")} organizations={[]} />);
    expect(html).toContain('href="/accounts/new"');
    expect(html).toContain("No organizations yet");
  });
});

describe("NewAccountForm", () => {
  it("AC9: the three roles start unselected and each is a single radio choice", () => {
    const html = renderToStaticMarkup(<NewAccountForm user={userOf("super_admin")} accounts={[]} />);
    expect(ROLE_OPTIONS.map((o) => o.id)).toEqual(["super_admin", "staff", "fundraising_consultant"]);
    expect((html.match(/type="radio"/g) ?? []).length).toBe(3);
    expect(html).not.toContain("checked");
    expect(html).toContain("Create account");
  });

  it("AC9: the account list shows exactly one role badge per account", () => {
    const html = renderToStaticMarkup(
      <NewAccountForm
        user={userOf("super_admin")}
        accounts={[{ id: "u1", email: "a@org.example", role: "staff" }]}
      />,
    );
    expect((html.match(/class="badge /g) ?? []).length).toBe(2); // the strip's own badge + one row
  });

  it("AC1/AC9: creates the account with the one chosen role", async () => {
    const created = { id: "u1", email: "n@org.example", role: "fundraising_consultant" as const };
    const createAccount = vi.fn(async () => ({ ok: true as const, value: created }));
    const result = await handleCreateAccount({ createAccount }, " n@org.example ", "Welcome-2026", "fundraising_consultant");
    expect(createAccount).toHaveBeenCalledWith({
      email: "n@org.example",
      password: "Welcome-2026",
      role: "fundraising_consultant",
    });
    expect(result).toEqual({ kind: "created", account: created });
  });

  it("AC9: no role, bad email or short password is refused before the API", async () => {
    const createAccount = vi.fn();
    const result = await handleCreateAccount({ createAccount }, "nope", "short", null);
    expect(result).toEqual({
      kind: "invalid",
      errors: {
        email: "Enter an email like name@example.com",
        password: "Use at least 8 characters",
        role: "Choose one role",
      },
    });
    expect(createAccount).not.toHaveBeenCalled();
  });
});
