import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSession, getTemplates, redirect } = vi.hoisted(() => ({
  getSession: vi.fn(),
  getTemplates: vi.fn(async () => [
    { role: "software-engineer", name: "Software engineer", taskCount: 1, planCount: 0 },
  ]),
  redirect: vi.fn((href: string): never => {
    throw new Error(`redirect:${href}`);
  }),
}));
vi.mock("@/lib/session", () => ({ getSession }));
vi.mock("@/lib/onboardingTemplates", () => ({ getTemplates }));
vi.mock("next/navigation", () => ({ redirect }));

import { TemplatesScreen } from "@/components/onboarding-templates/TemplatesScreen";
import OnboardingTemplatesPage from "./page";

beforeEach(() => vi.clearAllMocks());

describe("OnboardingTemplatesPage", () => {
  it("sends a signed-out visitor to sign-in without loading templates", async () => {
    getSession.mockResolvedValue(null);
    await expect(OnboardingTemplatesPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      "redirect:/sign-in?next=%2Fonboarding-templates",
    );
    expect(getTemplates).not.toHaveBeenCalled();
  });

  it("marks HR, and only HR, as able to edit", async () => {
    getSession.mockResolvedValue({ role: "hr" });
    const hr = await OnboardingTemplatesPage({ searchParams: Promise.resolve({}) });
    expect(hr.type).toBe(TemplatesScreen);
    expect(hr.props.isHr).toBe(true);
    getSession.mockResolvedValue({ role: "player" });
    const other = await OnboardingTemplatesPage({ searchParams: Promise.resolve({}) });
    expect(other.props.isHr).toBe(false);
  });

  it("names the saved role for the toast, and ignores an unknown one", async () => {
    getSession.mockResolvedValue({ role: "hr" });
    const saved = await OnboardingTemplatesPage({
      searchParams: Promise.resolve({ saved: "software-engineer" }),
    });
    expect(saved.props.savedName).toBe("Software engineer");
    const bogus = await OnboardingTemplatesPage({ searchParams: Promise.resolve({ saved: "x" }) });
    expect(bogus.props.savedName).toBeUndefined();
  });
});
