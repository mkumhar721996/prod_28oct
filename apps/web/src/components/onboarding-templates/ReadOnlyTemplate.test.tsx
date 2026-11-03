import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Template } from "@/lib/onboardingTemplates";
import { ReadOnlyTemplate } from "./ReadOnlyTemplate";

const template: Template = {
  role: "software-engineer",
  name: "Software engineer",
  planCount: 14,
  tasks: [
    { title: "Hold 90-day review", owner: "hiring_manager", direction: "after", days: 90 },
    { title: "Set up laptop", owner: "it", direction: "before", days: 3 },
  ],
};

describe("ReadOnlyTemplate", () => {
  const html = renderToStaticMarkup(<ReadOnlyTemplate template={template} />);

  it("shows the tasks, owners and due dates earliest first", () => {
    expect(html).toContain("<h1>Software engineer template</h1>");
    expect(html.indexOf("Set up laptop")).toBeLessThan(html.indexOf("Hold 90-day review"));
    expect(html).toContain('<span class="badge badge-info">IT</span>');
    expect(html).toContain("3 days before start");
    expect(html).toContain("Day 90 after start");
    expect(html).toContain("Only HR can change it.");
  });

  it("has no create or edit controls (AC12)", () => {
    expect(html).not.toMatch(/<button/);
    expect(html).not.toMatch(/New template|Edit|Add task|Save template/);
  });
});
