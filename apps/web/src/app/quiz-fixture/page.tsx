import { notFound } from "next/navigation";
import { ParagraphBlocks } from "../../components/paragraphs/ParagraphBlocks";

// Stand-in for a Drupal-backed page until real paragraph data loading exists; used by the e2e
// spec. Enabled only when QUIZ_FIXTURE=1 (set by playwright.config.ts), never in production.
const blocks = [
  {
    type: "quiz_survey",
    id: "fixture",
    questions: [
      {
        id: "q1",
        prompt: "What is your role?",
        options: [
          { id: "dev", label: "Developer" },
          { id: "des", label: "Designer" },
        ],
      },
      {
        id: "q2",
        prompt: "How do you work?",
        options: [
          { id: "solo", label: "Solo" },
          { id: "team", label: "In a team" },
        ],
      },
    ],
  },
];

export const dynamic = "force-dynamic";

export default function QuizFixturePage() {
  if (process.env.QUIZ_FIXTURE !== "1") notFound();
  return (
    <main className="shell-main">
      <ParagraphBlocks blocks={blocks} />
    </main>
  );
}
