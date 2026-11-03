import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import type { Hire, Plan } from "@/lib/hires";
import { HirePlanScreen } from "./HirePlanScreen";
import { HireRecordScreen } from "./HireRecordScreen";

const hire: Hire = {
  id: "hire-1",
  name: "Alex Morgan",
  role: "software-engineer",
  roleName: "Software engineer",
  startDate: "2026-12-01",
  managerName: "Dana Lee",
  planId: null,
};
const plan: Plan = {
  id: "plan-1",
  hireName: "Alex Morgan",
  roleName: "Software engineer",
  startDate: "2026-12-01",
  doneCount: 0,
  tasks: [
    { title: "Welcome", owner: "hr", assignee: "HR", dueOffsetDays: -30, dueDate: "2026-11-01", status: "not_started" },
    { title: "Meet", owner: "hiring_manager", assignee: "Dana Lee", dueOffsetDays: 1, dueDate: "2026-12-02", status: "not_started" },
  ],
};

describe("HireRecordScreen", () => {
  const html = renderToStaticMarkup(<HireRecordScreen hire={hire} managers={["Dana Lee"]} />);

  it("shows the record fields and one primary Create plan button", () => {
    expect(html).toContain("<h1>Hire record</h1>");
    expect(html).toContain("Role: Software engineer");
    expect(html).toContain('value="01/12/2026"');
    expect(html).toContain("Task due dates are counted from this date.");
    expect(html).toContain('<option value="">Choose manager</option>');
    expect(html.match(/btn-primary/g)).toHaveLength(1);
    expect(html).toContain("Create plan");
    expect(html).toContain('<span class="badge badge-neutral">No plan yet</span>');
  });

  it("starts with no alert and no invalid fields", () => {
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain("is-invalid");
  });

  it("offers View plan once a plan exists", () => {
    const withPlan = renderToStaticMarkup(
      <HireRecordScreen hire={{ ...hire, planId: "plan-1" }} managers={["Dana Lee"]} />,
    );
    expect(withPlan).toContain("View plan");
    expect(withPlan).toContain('<span class="badge badge-success">Plan created</span>');
  });
});

describe("HirePlanScreen", () => {
  const html = renderToStaticMarkup(<HirePlanScreen hireId="hire-1" plan={plan} />);

  it("says the plan is its own copy of the template (AC6)", () => {
    expect(html).toContain(
      "This plan is its own copy of the Software engineer template. Later template edits do not change it.",
    );
  });

  it("shows the heading, start date, due dates and progress", () => {
    expect(html).toContain("Alex Morgan’s plan");
    expect(html).toContain('value="01/12/2026"');
    expect(html).toContain("1 November 2026");
    expect(html).toContain('aria-label="Done: 0 of 2 tasks"');
    expect(html).toContain("0 of 2");
    expect(html).toContain("Save start date");
    expect(html).toContain("Back to hire record");
  });

  it("starts without an error or saved message", () => {
    expect(html).not.toContain("Every due date moved with it.");
    expect(html).not.toContain("is-invalid");
  });
});
