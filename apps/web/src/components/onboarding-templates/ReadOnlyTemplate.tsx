import { sortTasks, type Template } from "@/lib/onboardingTemplates";
import { TemplateTaskRow } from "./TemplateTaskRow";

/** What a signed-in user who is not HR sees: the checklist, with no create or edit controls. */
export function ReadOnlyTemplate({ template }: { template: Template }) {
  return (
    <div className="stack stack-4">
      <h1>{template.name} template</h1>
      <p className="text-muted">The standard checklist for this role. Only HR can change it.</p>
      <ul className="list" aria-label="Template tasks">
        {sortTasks(template.tasks).map((task, i) => (
          <TemplateTaskRow key={i} task={task} />
        ))}
      </ul>
    </div>
  );
}
