"use client";

import { useEffect, useReducer, useState } from "react";
import { classNamesForType, type ParagraphBlock } from "../registry";
import {
  initialState,
  loadState,
  parseQuizBlock,
  quizReducer,
  saveState,
  type QuizAction,
  type QuizState,
} from "./quizSurveyState";

type Hydrate = QuizAction | { type: "hydrate"; state: QuizState };

export default function QuizSurvey({ block }: { block: ParagraphBlock }) {
  const { id, questions } = parseQuizBlock(block);
  const key = `quiz:${id}`;
  const [state, dispatch] = useReducer(
    (s: QuizState, a: Hydrate) => (a.type === "hydrate" ? a.state : quizReducer(questions, s, a)),
    undefined,
    initialState,
  );
  const [ready, setReady] = useState(false);

  // Restore after mount so the server render and first client render match.
  useEffect(() => {
    dispatch({ type: "hydrate", state: loadState(window.localStorage, key, questions) });
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (ready) saveState(window.localStorage, key, state);
  }, [ready, key, state]);

  const question = questions[state.step];
  const answered = question !== undefined && state.answers[question.id] !== undefined;
  const last = state.step === questions.length - 1;

  return (
    <div className={`${classNamesForType(block.type)} quiz-survey`}>
      {state.completed ? (
        <p role="status" className="quiz-survey__done">
          Thank you, you have completed the quiz.
        </p>
      ) : question ? (
        <form onSubmit={(e) => e.preventDefault()}>
          <fieldset className="quiz-survey__question">
            <legend className="quiz-survey__prompt">{question.prompt}</legend>
            {question.options.map((option) => (
              <label key={option.id} className="quiz-survey__option">
                <input
                  type="radio"
                  name={`${key}:${question.id}`}
                  value={option.id}
                  checked={state.answers[question.id] === option.id}
                  onChange={() =>
                    dispatch({ type: "answer", questionId: question.id, optionId: option.id })
                  }
                />
                {option.label}
              </label>
            ))}
          </fieldset>
          <div className="quiz-survey__actions">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={state.step === 0}
              onClick={() => dispatch({ type: "back" })}
            >
              Back
            </button>
            {last ? (
              <button
                type="button"
                className="btn"
                disabled={!answered}
                onClick={() => dispatch({ type: "finish" })}
              >
                Finish
              </button>
            ) : (
              <button
                type="button"
                className="btn"
                disabled={!answered}
                onClick={() => dispatch({ type: "next" })}
              >
                Next
              </button>
            )}
          </div>
        </form>
      ) : null}
    </div>
  );
}
