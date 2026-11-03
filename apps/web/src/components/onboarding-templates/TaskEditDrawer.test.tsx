import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { validateTask, type TemplateTask } from "@/lib/onboardingTemplates";
import { TaskEditDrawer, draftFrom, firstInvalid } from "./TaskEditDrawer";

const saved: TemplateTask = { title: "Set up laptop", owner: "it", direction: "before", days: 3 };
const render = (props: Partial<React.ComponentProps<typeof TaskEditDrawer>> = {}) =>
  renderToStaticMarkup(
    <TaskEditDrawer task={null} roleName="Software engineer" onDone={vi.fn()} onCancel={vi.fn()} {...props} />,
  );

describe("TaskEditDrawer markup", () => {
  it("is a labelled form dialog with the role badge, defaulting to After start", () => {
    const html = render();
    expect(html).toMatch(/<form[^>]*class="drawer is-open"[^>]*aria-labelledby="drawer-title"/);
    expect(html).toContain('<h2 id="drawer-title">Add task</h2>');
    expect(html).toContain('<span class="badge badge-neutral">Software engineer</span>');
    expect(html).toMatch(/name="direction" checked="" value="after"/);
    expect(html).toMatch(/inputMode="numeric"/i);
    expect(html).toContain("0 is the start date. The latest due date is day 90 after start.");
    expect(html).toMatch(/btn btn-ghost[^>]*>Cancel</);
    expect(html).toMatch(/type="submit" class="btn btn-primary">Done</);
  });

  it("offers the four owners as radios, none chosen for a new task (AC3)", () => {
    const html = render();
    const labels = [...html.matchAll(/name="owner"[^>]*\/>([^<]*)</g)].map((m) => m[1]);
    expect(labels).toEqual(["Hiring manager", "IT", "New hire", "HR"]);
    expect(html).not.toMatch(/name="owner"[^>]*checked/);
  });

  it("shows the edited task's owner, due direction and days", () => {
    const html = render({ task: saved });
    expect(html).toContain('<h2 id="drawer-title">Edit task</h2>');
    expect(html).toMatch(/name="owner" checked="" value="it"/);
    expect(html).toMatch(/name="direction" checked="" value="before"/);
    expect(html).toContain('value="3"');
    expect(html).toContain('value="Set up laptop"');
  });

  it("shows the owner error inline and marks nothing else (AC7)", () => {
    const html = render({ initialErrors: validateTask({ ...draftFrom(null), title: "A", days: "1" }) });
    expect(html).toContain('role="alert">Choose an owner for this task.<');
    expect(html).toContain('class="radio is-invalid"');
    expect(html).not.toContain('class="input is-invalid"');
  });

  it("shows the due-date error and marks the days input invalid (AC8)", () => {
    const html = render({
      initialErrors: validateTask({ ...draftFrom(null), title: "A", owner: "it", days: "" }),
    });
    expect(html).toContain("Set a due date: enter the number of days, like 30.");
    expect(html).toMatch(/class="input is-invalid" id="task-days"[^>]*aria-invalid="true"/);
  });

  it("shows the day 90 error for day 91 after start (AC9)", () => {
    const html = render({
      initialErrors: validateTask({ ...draftFrom(null), title: "A", owner: "it", days: "91" }),
    });
    expect(html).toContain("Day 90 is the latest allowed due date. Enter 90 or fewer.");
  });
});

describe("drawer helpers", () => {
  it("starts blank (after start) for a new task and from the task when editing", () => {
    expect(draftFrom(null)).toEqual({ title: "", owner: null, direction: "after", days: "" });
    expect(draftFrom(saved)).toEqual({
      title: "Set up laptop",
      owner: "it",
      direction: "before",
      days: "3",
    });
  });

  it("focuses the first invalid control in screen order", () => {
    expect(firstInvalid({})).toBeNull();
    expect(firstInvalid({ due: "x", owner: "y" })).toBe("owner");
    expect(firstInvalid({ due: "x", title: "z" })).toBe("title");
    expect(firstInvalid({ due: "x" })).toBe("due");
  });
});
