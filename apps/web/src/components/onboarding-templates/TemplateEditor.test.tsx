import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/onboardingTemplates", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/onboardingTemplates")>()),
  createTemplate: vi.fn(),
  updateTemplate: vi.fn(),
}));

import type { TemplateTask } from "@/lib/onboardingTemplates";
import { NO_TASKS_ERROR, TemplateEditor, plansNote } from "./TemplateEditor";

const tasks: TemplateTask[] = [
  { title: "Meet hiring manager", owner: "hiring_manager", direction: "after", days: 1 },
  { title: "Set up laptop", owner: "it", direction: "before", days: 3 },
  { title: "Hold 90-day review", owner: "hiring_manager", direction: "after", days: 90 },
];
const render = (props: Partial<React.ComponentProps<typeof TemplateEditor>> = {}) =>
  renderToStaticMarkup(
    <TemplateEditor
      role="software-engineer"
      name="Software engineer"
      planCount={0}
      initialTasks={tasks}
      mode="edit"
      {...props}
    />,
  );

describe("TemplateEditor markup", () => {
  it("titles the page with the role and lists tasks earliest first (AC1, AC2)", () => {
    const html = render();
    expect(html).toContain("<h1>Software engineer template</h1>");
    const titles = [...html.matchAll(/<span class="grow">([^<]*)</g)].map((m) => m[1]);
    expect(titles).toEqual(["Set up laptop", "Meet hiring manager", "Hold 90-day review"]);
    expect(html).toContain("30 days before start".replace("30", "3"));
    expect(html).toContain("Day 90 after start");
    expect(html).toContain('aria-label="Edit task Set up laptop"');
  });

  it("shows owners and due dates on each task (AC3, AC4, AC5)", () => {
    const html = render();
    expect(html).toContain('<span class="badge badge-info">IT</span>');
    expect(html).toContain('<span class="badge badge-info">Hiring manager</span>');
    expect(html).toContain("3 days before start");
  });

  it("has one primary Save template plus Add task and Cancel, and no drawer by default", () => {
    const html = render();
    expect(html.match(/btn btn-primary/g)).toHaveLength(1);
    expect(html).toMatch(/btn btn-primary"[^>]*>Save template</);
    expect(html).toMatch(/btn btn-secondary"[^>]*>(?:<svg.*?<\/svg>)?Add task</);
    expect(html).toMatch(/btn btn-ghost"[^>]*>Cancel</);
    expect(html).not.toContain('role="dialog"');
  });

  it("says existing plans are unchanged when there are some (AC6)", () => {
    const html = render({ planCount: 14 });
    expect(html).toMatch(/keep their tasks, owners and due dates/);
    expect(html).toContain("(14 plans unchanged)");
    expect(plansNote(1)).toContain("(1 plan unchanged)");
  });

  it("has no plans note for a template with no plans", () => {
    expect(render({ planCount: 0 })).not.toContain("keep their tasks");
  });

  it("asks for a first task and shows the alert when saving with none (AC10)", () => {
    const html = render({ initialTasks: [], mode: "create", initial: { noTasksError: true } });
    expect(html).toContain("No tasks yet.");
    expect(html).toMatch(/class="alert alert-danger" role="alert" tabindex="-1"/);
    expect(html).toContain(NO_TASKS_ERROR);
  });

  it("shows Saving… and disables Save and Cancel while saving", () => {
    const html = render({ initial: { saving: true } });
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Saving…<\/button>/);
    expect(html).not.toContain(">Save template<");
  });

  it("shows an API error as an alert", () => {
    expect(render({ initial: { error: "We couldn't save the template. Try again." } })).toContain(
      "We couldn&#x27;t save the template. Try again.",
    );
  });

  it("opens the task drawer for the chosen task", () => {
    const html = render({ initial: { drawer: 1 } });
    expect(html).toContain('<h2 id="drawer-title">Edit task</h2>');
    expect(html).toContain('value="Set up laptop"');
  });

  it("opens a blank drawer for a new task", () => {
    expect(render({ initial: { drawer: "new" } })).toContain('<h2 id="drawer-title">Add task</h2>');
  });
});
