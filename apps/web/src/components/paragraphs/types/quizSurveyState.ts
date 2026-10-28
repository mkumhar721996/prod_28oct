import type { ParagraphBlock } from "../registry";

// Pure quiz logic, kept out of the barrel (index.ts) because the registry treats every barrel
// export as a paragraph component. Step rules are assumed, not confirmed against production.

export interface QuizOption {
  id: string;
  label: string;
}
export interface QuizQuestion {
  id: string;
  prompt: string;
  options: QuizOption[];
}
export interface QuizState {
  step: number;
  answers: Record<string, string>;
  completed: boolean;
}
export type QuizAction =
  | { type: "answer"; questionId: string; optionId: string }
  | { type: "next" }
  | { type: "back" }
  | { type: "finish" };

export function initialState(): QuizState {
  return { step: 0, answers: {}, completed: false };
}

export function quizReducer(
  questions: QuizQuestion[],
  state: QuizState,
  action: QuizAction,
): QuizState {
  const current = questions[state.step];
  const answered = current !== undefined && state.answers[current.id] !== undefined;
  switch (action.type) {
    case "answer": {
      const question = questions.find((q) => q.id === action.questionId);
      if (!question || !question.options.some((o) => o.id === action.optionId)) return state;
      return { ...state, answers: { ...state.answers, [question.id]: action.optionId } };
    }
    case "next":
      return answered && state.step < questions.length - 1
        ? { ...state, step: state.step + 1 }
        : state;
    case "back":
      return state.step > 0 ? { ...state, step: state.step - 1 } : state;
    case "finish":
      return answered && state.step === questions.length - 1
        ? { ...state, completed: true }
        : state;
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export function parseQuizBlock(block: ParagraphBlock): { id: string; questions: QuizQuestion[] } {
  const raw = Array.isArray(block.questions) ? block.questions : [];
  const questions: QuizQuestion[] = [];
  for (const q of raw) {
    if (!isRecord(q) || typeof q.id !== "string" || typeof q.prompt !== "string") continue;
    const options = (Array.isArray(q.options) ? q.options : []).flatMap((o: unknown) =>
      isRecord(o) && typeof o.id === "string" && typeof o.label === "string"
        ? [{ id: o.id, label: o.label }]
        : [],
    );
    questions.push({ id: q.id, prompt: q.prompt, options });
  }
  return { id: block.id ?? "", questions };
}

export function loadState(
  store: Pick<Storage, "getItem">,
  key: string,
  questions: QuizQuestion[],
): QuizState {
  try {
    const raw = store.getItem(key);
    if (raw === null) return initialState();
    const data: unknown = JSON.parse(raw);
    if (!isRecord(data) || !isRecord(data.answers)) return initialState();
    const { step, answers, completed } = data;
    if (typeof completed !== "boolean") return initialState();
    if (!Number.isInteger(step) || (step as number) < 0) return initialState();
    if ((step as number) > Math.max(questions.length - 1, 0)) return initialState();
    const clean: Record<string, string> = {};
    for (const [qid, oid] of Object.entries(answers)) {
      const known = questions.find((q) => q.id === qid)?.options.some((o) => o.id === oid);
      if (!known) return initialState();
      clean[qid] = oid as string;
    }
    return { step: step as number, answers: clean, completed };
  } catch {
    return initialState();
  }
}

export function saveState(store: Pick<Storage, "setItem">, key: string, state: QuizState): void {
  try {
    store.setItem(key, JSON.stringify(state));
  } catch {
    // Storage may be full or blocked; the quiz still works for this visit.
  }
}
