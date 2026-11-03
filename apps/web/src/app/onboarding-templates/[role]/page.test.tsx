import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSession, getTemplate, redirect, notFound } = vi.hoisted(() => ({
  getSession: vi.fn(),
  getTemplate: vi.fn(),
  redirect: vi.fn((href: string): never => {
    throw new Error(`redirect:${href}`);
  }),
  notFound: vi.fn((): never => {
    throw new Error("not-found");
  }),
}));
vi.mock("@/lib/session", () => ({ getSession }));
vi.mock("@/lib/onboardingTemplates", () => ({ getTemplate }));
vi.mock("next/navigation", () => ({ redirect, notFound }));

import { ReadOnlyTemplate } from "@/components/onboarding-templates/ReadOnlyTemplate";
import { TemplateEditor } from "@/components/onboarding-templates/TemplateEditor";
import OnboardingTemplatePage from "./page";

const template = {
  role: "software-engineer",
  name: "Software engineer",
  planCount: 14,
  tasks: [{ title: "Set up laptop", owner: "it", direction: "before", days: 3 }],
};
const params = Promise.resolve({ role: "software-engineer" });

beforeEach(() => vi.clearAllMocks());

describe("OnboardingTemplatePage", () => {
  it("sends a signed-out visitor to sign-in without loading the template", async () => {
    getSession.mockResolvedValue(null);
    await expect(OnboardingTemplatePage({ params })).rejects.toThrow(
      "redirect:/sign-in?next=%2Fonboarding-templates",
    );
    expect(getTemplate).not.toHaveBeenCalled();
  });

  it("gives HR the editor for the role (AC2)", async () => {
    getSession.mockResolvedValue({ role: "hr" });
    getTemplate.mockResolvedValue(template);
    const el = await OnboardingTemplatePage({ params });
    expect(el.type).toBe(TemplateEditor);
    expect(el.props).toMatchObject({ role: "software-engineer", mode: "edit", planCount: 14 });
    expect(getTemplate).toHaveBeenCalledWith("software-engineer");
  });

  it("gives any other signed-in user the read-only view (AC12)", async () => {
    getSession.mockResolvedValue({ role: "player" });
    getTemplate.mockResolvedValue(template);
    const el = await OnboardingTemplatePage({ params });
    expect(el.type).toBe(ReadOnlyTemplate);
  });

  it("is a 404 for a role with no template", async () => {
    getSession.mockResolvedValue({ role: "hr" });
    getTemplate.mockResolvedValue(null);
    await expect(OnboardingTemplatePage({ params })).rejects.toThrow("not-found");
  });
});
