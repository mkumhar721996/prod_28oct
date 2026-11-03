import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import type { JobRole, TemplateSummary } from "@/lib/onboardingTemplates";
import { CHOOSE_ROLE_ERROR, NewTemplateForm, roleError } from "./NewTemplateForm";

const roles: JobRole[] = [
  { role: "software-engineer", name: "Software engineer" },
  { role: "account-manager", name: "Account manager" },
];
const existing: TemplateSummary[] = [
  { role: "software-engineer", name: "Software engineer", taskCount: 5, planCount: 14 },
];

describe("roleError", () => {
  it("refuses no role", () => {
    expect(roleError("", roles, existing)).toBe(CHOOSE_ROLE_ERROR);
  });

  it("refuses a role that already has a template, naming it (AC11)", () => {
    expect(roleError("software-engineer", roles, existing)).toBe(
      "A template already exists for Software engineer. Edit it from the templates list instead.",
    );
  });

  it("lets a role without a template continue", () => {
    expect(roleError("account-manager", roles, existing)).toBeNull();
  });
});

describe("NewTemplateForm markup", () => {
  const render = (initialError?: string) =>
    renderToStaticMarkup(<NewTemplateForm roles={roles} existing={existing} initialError={initialError} />);

  it("offers Choose a role plus the job roles, with Cancel and one primary Continue", () => {
    const html = render();
    const options = [...html.matchAll(/<option[^>]*>([^<]*)<\/option>/g)].map((m) => m[1]);
    expect(options).toEqual(["Choose a role", "Software engineer", "Account manager"]);
    expect(html).toContain("<h1>New onboarding template</h1>");
    expect(html).toMatch(/btn btn-ghost"[^>]*>Cancel</);
    expect(html.match(/btn btn-primary/g)).toHaveLength(1);
    expect(html).not.toContain("field-error");
  });

  it("shows the error inline and marks the select invalid", () => {
    const html = render("A template already exists for Software engineer. Edit it from the templates list instead.");
    expect(html).toContain('role="alert">A template already exists for Software engineer.');
    expect(html).toContain("select is-invalid");
  });
});
