import { describe, expect, it } from "vitest";
import {
  initialState,
  loadState,
  parseQuizBlock,
  quizReducer,
  saveState,
  type QuizQuestion,
} from "./quizSurveyState";

const qs: QuizQuestion[] = [
  {
    id: "q1",
    prompt: "A?",
    options: [
      { id: "a", label: "A" },
      { id: "b", label: "B" },
    ],
  },
  { id: "q2", prompt: "B?", options: [{ id: "c", label: "C" }] },
];

const memory = () => {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  };
};

describe("quizReducer (AC1)", () => {
  it("steps through and finishes", () => {
    let s = initialState();
    s = quizReducer(qs, s, { type: "answer", questionId: "q1", optionId: "a" });
    s = quizReducer(qs, s, { type: "next" });
    expect(s.step).toBe(1);
    s = quizReducer(qs, s, { type: "answer", questionId: "q2", optionId: "c" });
    s = quizReducer(qs, s, { type: "finish" });
    expect(s.completed).toBe(true);
    expect(s.answers).toEqual({ q1: "a", q2: "c" });
  });

  it("does not advance without an answer, and back at 0 stays at 0", () => {
    expect(quizReducer(qs, initialState(), { type: "next" }).step).toBe(0);
    expect(quizReducer(qs, initialState(), { type: "back" }).step).toBe(0);
  });

  it("does not finish before the last step is answered", () => {
    expect(quizReducer(qs, initialState(), { type: "finish" }).completed).toBe(false);
  });

  it("goes back one step", () => {
    const s = { step: 1, answers: { q1: "a" }, completed: false };
    expect(quizReducer(qs, s, { type: "back" }).step).toBe(0);
  });

  it("ignores unknown options", () => {
    const s = quizReducer(qs, initialState(), { type: "answer", questionId: "q1", optionId: "zz" });
    expect(s.answers).toEqual({});
  });
});

describe("parseQuizBlock (AC2)", () => {
  it("preserves Drupal order and tolerates missing questions", () => {
    const parsed = parseQuizBlock({ type: "quiz_survey", id: "p1", questions: qs });
    expect(parsed.id).toBe("p1");
    expect(parsed.questions[0].options.map((o) => o.id)).toEqual(["a", "b"]);
    expect(parseQuizBlock({ type: "quiz_survey" }).questions).toEqual([]);
  });

  it("drops malformed questions and options", () => {
    const parsed = parseQuizBlock({
      type: "quiz_survey",
      questions: [null, { id: "q", prompt: "P", options: [{ id: "x" }, { id: "y", label: "Y" }] }],
    });
    expect(parsed.questions).toEqual([{ id: "q", prompt: "P", options: [{ id: "y", label: "Y" }] }]);
  });
});

describe("persistence (AC4)", () => {
  it("restores saved state and discards invalid state", () => {
    const mem = memory();
    const saved = { step: 1, answers: { q1: "a" }, completed: false };
    saveState(mem, "quiz:p1", saved);
    expect(loadState(mem, "quiz:p1", qs)).toEqual(saved);
    mem.setItem("quiz:p1", "not json");
    expect(loadState(mem, "quiz:p1", qs)).toEqual(initialState());
    mem.setItem("quiz:p1", JSON.stringify({ step: 0, answers: { q1: "zzz" }, completed: false }));
    expect(loadState(mem, "quiz:p1", qs)).toEqual(initialState());
    mem.setItem("quiz:p1", JSON.stringify({ step: 9, answers: {}, completed: false }));
    expect(loadState(mem, "quiz:p1", qs)).toEqual(initialState());
  });

  it("returns the initial state when nothing is stored", () => {
    expect(loadState(memory(), "quiz:none", qs)).toEqual(initialState());
  });
});
