import { dueLabel, ownerLabel, type TemplateTask } from "@/lib/onboardingTemplates";

/** One task: name, owner and due date; the Edit task button only when the viewer may edit. */
export function TemplateTaskRow({
  task,
  onEdit,
}: {
  task: TemplateTask;
  /** Omitted in the read-only view. */
  onEdit?: () => void;
}) {
  return (
    <li>
      <div className="card">
        <div className="row-between">
          <span className="grow">{task.title}</span>
          <span className="task-meta">
            <span className="badge badge-info">{ownerLabel(task.owner)}</span>
            <span className="badge badge-neutral">{dueLabel(task)}</span>
          </span>
          {onEdit && (
            <button
              type="button"
              className="btn btn-secondary"
              aria-label={`Edit task ${task.title}`}
              onClick={onEdit}
            >
              Edit task
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
