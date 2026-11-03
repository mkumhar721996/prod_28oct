import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PlanTask } from "@/lib/hires";
import { HirePlanTable } from "./HirePlanTable";

const task = (over: Partial<PlanTask> = {}): PlanTask => ({
  title: "Set up laptop",
  owner: "it",
  assignee: "IT",
  dueOffsetDays: -30,
  dueDate: "2026-11-01",
  status: "not_started",
  ...over,
});
const render = (tasks: PlanTask[], moved = false) =>
  renderToStaticMarkup(<HirePlanTable hireName="Alex Morgan" tasks={tasks} moved={moved} />);

describe("HirePlanTable", () => {
  it("has a caption and the four column headers", () => {
    const html = render([task()]);
    expect(html).toContain("Tasks for Alex Morgan, earliest due date first");
    for (const col of ["Task", "Owner", "Due date", "Status"]) {
      expect(html).toContain(`<th scope="col">${col}</th>`);
    }
  });

  it("shows the assignee as the owner badge (AC3)", () => {
    expect(render([task({ owner: "hiring_manager", assignee: "Dana Lee" })])).toContain(
      '<span class="badge badge-info">Dana Lee</span>',
    );
  });

  it("shows the due date in full and a Not started badge (AC2)", () => {
    const html = render([task()]);
    expect(html).toContain('<td class="due">1 November 2026</td>');
    expect(html).toContain('<span class="badge badge-neutral">Not started</span>');
  });

  it("marks due dates as moved after a start-date save", () => {
    expect(render([task()], true)).toContain('<td class="due moved">1 November 2026</td>');
  });
});
