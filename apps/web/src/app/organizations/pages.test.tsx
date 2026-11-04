import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.fn();
const getOrganization = vi.fn();
const getOrganizations = vi.fn();
const getAccounts = vi.fn();
const redirect = vi.fn((href: string) => {
  throw new Error(`redirect:${href}`);
});
vi.mock("next/navigation", () => ({
  redirect: (href: string) => redirect(href),
  notFound: () => {
    throw new Error("not-found");
  },
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/orgSession", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/orgSession")>()),
  getCurrentUser: () => getCurrentUser(),
  checkSession: vi.fn(),
  signOutUser: vi.fn(),
}));
vi.mock("@/lib/organizations", () => ({
  getOrganization: (id: string) => getOrganization(id),
  getOrganizations: () => getOrganizations(),
  getAccounts: () => getAccounts(),
  saveOrganization: vi.fn(),
  deleteOrganization: vi.fn(),
  createAccount: vi.fn(),
}));

import NewAccountPage from "../accounts/new/page";
import OrganizationPage from "./[id]/page";
import OrganizationsPage from "./page";

beforeEach(() => {
  for (const mock of [getCurrentUser, getOrganization, getOrganizations, getAccounts, redirect]) mock.mockClear();
});

describe("organization pages", () => {
  it("AC3: signed out, the detail page redirects to sign-in and never fetches the organization", async () => {
    getCurrentUser.mockResolvedValue(null);
    await expect(OrganizationPage({ params: Promise.resolve({ id: "o1" }) })).rejects.toThrow(
      "redirect:/accounts/sign-in",
    );
    expect(getOrganization).not.toHaveBeenCalled();
  });

  it("AC3: signed out, the list page redirects and never fetches the list", async () => {
    getCurrentUser.mockResolvedValue(null);
    await expect(OrganizationsPage()).rejects.toThrow("redirect:/accounts/sign-in");
    expect(getOrganizations).not.toHaveBeenCalled();
  });

  it("AC4: signed in, the detail page shows the organization", async () => {
    getCurrentUser.mockResolvedValue({ email: "s@org.example", role: "staff" });
    getOrganization.mockResolvedValue({ id: "o1", name: "Acme Giving", address: "1 High St" });
    const html = renderToStaticMarkup(await OrganizationPage({ params: Promise.resolve({ id: "o1" }) }));
    expect(html).toContain("Acme Giving");
  });
});

describe("new account page", () => {
  it.each(["staff", "fundraising_consultant"])("AC8: %s gets no account form", async (role) => {
    getCurrentUser.mockResolvedValue({ email: "s@org.example", role });
    const html = renderToStaticMarkup(await NewAccountPage());
    expect(html).not.toContain("Create account");
    expect(getAccounts).not.toHaveBeenCalled();
  });

  it("AC1: a super-admin gets the form", async () => {
    getCurrentUser.mockResolvedValue({ email: "r@org.example", role: "super_admin" });
    getAccounts.mockResolvedValue([]);
    expect(renderToStaticMarkup(await NewAccountPage())).toContain("Create account");
  });

  it("signed out is redirected", async () => {
    getCurrentUser.mockResolvedValue(null);
    await expect(NewAccountPage()).rejects.toThrow("redirect:/accounts/sign-in");
  });
});
