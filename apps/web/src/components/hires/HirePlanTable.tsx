import { assigneeLabel, formatDate, type PlanTask } from "@/lib/hires";

/** The hire's tasks, earliest due date first. `moved` bolds the dates briefly after a start-date save. */
export function HirePlanTable({
  hireName,
  tasks,
  moved = false,
}: {
  hireName: string;
  tasks: PlanTask[];
  moved?: boolean;
}) {
  return (
    <div className="table-wrap">
      <table className="plan-table">
        <caption className="text-sm text-muted">Tasks for {hireName}, earliest due date first</caption>
        <thead>
          <tr>
            <th scope="col">Task</th>
            <th scope="col">Owner</th>
            <th scope="col">Due date</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task, i) => (
            <tr key={i}>
              <td>{task.title}</td>
              <td>
                <span className="badge badge-info">{assigneeLabel(task.assignee)}</span>
              </td>
              <td className={`due${moved ? " moved" : ""}`}>{formatDate(task.dueDate)}</td>
              <td>
                <span className="badge badge-neutral">Not started</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
