import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));

import type { TemplateSummary } from "@/lib/onboardingTemplates";
import { TemplatesScreen } from "./TemplatesScreen";

const templates: TemplateSummary[] = [
  { role: "software-engineer", name: "Software engineer", taskCount: 1, planCount: 14 },
  { role: "customer-support-agent", name: "Customer support agent", taskCount: 3, planCount: 0 },
];
const render = (props: Partial<React.ComponentProps<typeof TemplatesScreen>> = {}) =>
  renderToStaticMarkup(<TemplatesScreen templates={templates} isHr {...props} />);

describe("TemplatesScreen", () => {
  it("lists each saved role with its task count (AC1)", () => {
    const html = render();
    expect(html).toContain("<h1>Onboarding templates</h1>");
    expect(html).toContain("Software engineer");
    expect(html).toContain('<span class="badge badge-neutral">1 task</span>');
    expect(html).toContain('<span class="badge badge-neutral">3 tasks</span>');
  });

  it("gives HR New template and an Edit link per role", () => {
    const html = render();
    expect(html).toMatch(/<a class="btn btn-primary" href="\/onboarding-templates\/new"[^>]*>.*New template<\/a>/);
    expect(html).toContain('href="/onboarding-templates/software-engineer"');
    expect(html).toContain('aria-label="Edit Software engineer template"');
  });

  it("gives a user who is not HR no create or edit controls, only View (AC12)", () => {
    const html = render({ isHr: false });
    expect(html).not.toMatch(/New template|Edit|btn-primary/);
    expect(html).toContain('aria-label="View Software engineer template"');
    expect(html).toContain("Software engineer");
  });

  it("explains the empty list and offers HR one action", () => {
    const html = render({ templates: [] });
    expect(html).toContain("No templates yet");
    expect(html).toContain("Create one per role so every hire starts from the same checklist.");
    expect(html.match(/New template/g)).toHaveLength(2);
    expect(html.match(/btn btn-primary/g)).toHaveLength(2);
  });

  it("shows the empty list to a user who is not HR with no action", () => {
    const html = render({ templates: [], isHr: false });
    expect(html).toContain("No templates yet");
    expect(html).not.toContain("btn-primary");
  });

  it("shows the saved toast once, naming the role", () => {
    expect(render({ savedName: "Software engineer" })).toContain("Software engineer template saved");
    expect(render()).not.toContain("template saved");
  });
});
