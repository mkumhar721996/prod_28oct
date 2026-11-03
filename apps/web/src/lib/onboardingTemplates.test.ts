import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LATEST_DUE_DAY,
  createTemplate,
  dueLabel,
  fromOffset,
  sortTasks,
  toOffset,
  updateTemplate,
  validateTask,
  type TaskDraft,
  type TemplateTask,
} from "./onboardingTemplates";

const task = (over: Partial<TemplateTask> = {}): TemplateTask => ({
  title: "Set up laptop",
  owner: "it",
  direction: "before",
  days: 3,
  ...over,
});
const draft = (over: Partial<TaskDraft> = {}): TaskDraft => ({
  title: "Set up laptop",
  owner: "it",
  direction: "after",
  days: "30",
  ...over,
});

describe("due dates", () => {
  it("30 days before start is offset -30 (AC4)", () => {
    expect(toOffset({ direction: "before", days: 30 })).toBe(-30);
    expect(dueLabel({ direction: "before", days: 30 })).toBe("30 days before start");
    expect(fromOffset(-30)).toEqual({ direction: "before", days: 30 });
  });

  it("day 90 after start is offset 90 (AC5)", () => {
    expect(toOffset({ direction: "after", days: 90 })).toBe(90);
    expect(dueLabel({ direction: "after", days: 90 })).toBe("Day 90 after start");
    expect(fromOffset(90)).toEqual({ direction: "after", days: 90 });
  });

  it("day 0 is the start date whichever way it is entered", () => {
    expect(toOffset({ direction: "before", days: 0 })).toBe(0);
    expect(Object.is(toOffset({ direction: "before", days: 0 }), 0)).toBe(true);
    expect(dueLabel({ direction: "before", days: 0 })).toBe("On the start date");
    expect(fromOffset(0)).toEqual({ direction: "after", days: 0 });
  });

  it("says 1 day, not 1 days", () => {
    expect(dueLabel({ direction: "before", days: 1 })).toBe("1 day before start");
  });

  it("sorts earliest first and keeps entry order for equal offsets", () => {
    const a = task({ title: "a", direction: "after", days: 5 });
    const b = task({ title: "b", direction: "before", days: 30 });
    const c = task({ title: "c", direction: "after", days: 5 });
    expect(sortTasks([a, b, c]).map((t) => t.title)).toEqual(["b", "a", "c"]);
  });
});

describe("validateTask", () => {
  it("accepts a complete task", () => {
    expect(validateTask(draft())).toEqual({});
    expect(validateTask(draft({ days: "90" }))).toEqual({});
    expect(validateTask(draft({ direction: "before", days: "400" }))).toEqual({});
  });

  it("names the owner when none is chosen (AC7)", () => {
    expect(validateTask(draft({ owner: null }))).toEqual({ owner: "Choose an owner for this task." });
  });

  it.each(["", "  ", "abc", "1.5", "-2"])("names the due date for days %p (AC8)", (days) => {
    expect(validateTask(draft({ days }))).toEqual({
      due: "Set a due date: enter the number of days, like 30.",
    });
  });

  it("says day 90 is the latest for day 91 after start (AC9)", () => {
    expect(validateTask(draft({ days: String(LATEST_DUE_DAY + 1) }))).toEqual({
      due: "Day 90 is the latest allowed due date. Enter 90 or fewer.",
    });
  });

  it("needs a task name", () => {
    expect(validateTask(draft({ title: " " }))).toEqual({
      title: "Enter a task name, like “Set up laptop”.",
    });
  });
});

describe("saving", () => {
  afterEach(() => vi.unstubAllGlobals());

  const respond = (status: number, body: unknown) =>
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status })));

  it("createTemplate posts the role and signed offsets", async () => {
    respond(201, { ok: true });
    expect(await createTemplate("software-engineer", [task()])).toEqual({ ok: true });
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/onboarding-templates");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({
      role: "software-engineer",
      tasks: [{ title: "Set up laptop", owner: "it", dueOffsetDays: -3 }],
    });
  });

  it("updateTemplate puts the tasks under the role", async () => {
    respond(200, { ok: true });
    await updateTemplate("software-engineer", [task()]);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/onboarding-templates/software-engineer");
    expect(init?.method).toBe("PUT");
  });

  it("returns the API message and task for a refusal", async () => {
    respond(400, { code: "due_too_late", taskIndex: 2, message: "Day 90 is the latest allowed due date." });
    expect(await updateTemplate("software-engineer", [task()])).toEqual({
      ok: false,
      kind: "invalid",
      message: "Day 90 is the latest allowed due date.",
      taskIndex: 2,
    });
  });

  it("flags an existing role", async () => {
    respond(409, { code: "role_exists", message: "A template already exists." });
    expect(await createTemplate("software-engineer", [task()])).toMatchObject({
      ok: false,
      kind: "role_exists",
    });
  });

  it("never throws, even offline", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    expect(await createTemplate("software-engineer", [task()])).toMatchObject({
      ok: false,
      kind: "error",
    });
  });
});
