import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ParagraphBlocks } from "./ParagraphBlocks";
import { defaultRegistry } from "./registry.default";

const block = {
  type: "quiz_survey",
  id: "p1",
  questions: [
    {
      id: "q1",
      prompt: "What is your role?",
      options: [
        { id: "dev", label: "Developer" },
        { id: "des", label: "Designer" },
      ],
    },
    { id: "q2", prompt: "Question two", options: [{ id: "x", label: "Option X" }] },
  ],
};
const render = (b: object) => renderToStaticMarkup(<ParagraphBlocks blocks={[b as never]} />);

describe("QuizSurvey", () => {
  it("is registered as quiz_survey", () => {
    expect(defaultRegistry.types()).toContain("quiz_survey");
  });

  it("renders Drupal questions and options with Drupal classes (AC2)", () => {
    const html = render(block);
    expect(html).toContain("What is your role?");
    expect(html).toContain("Developer");
    expect(html).toContain('class="paragraph paragraph--type--quiz-survey');
  });

  it("renders only step 0, one question, options in order (AC3)", () => {
    const html = render(block);
    expect(html).not.toContain("Question two");
    expect(html.indexOf("Developer")).toBeLessThan(html.indexOf("Designer"));
  });

  it("renders a block with no questions without throwing", () => {
    expect(() => render({ type: "quiz_survey" })).not.toThrow();
  });
});
