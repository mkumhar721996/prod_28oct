import { ONBOARDING_TEMPLATES_HREF } from "@/lib/shell";
import { taskCount, type TemplateSummary } from "@/lib/onboardingTemplates";

/** One role's template in the list: HR gets Edit, everyone else a read-only View. */
export function TemplateRoleRow({ template, isHr }: { template: TemplateSummary; isHr: boolean }) {
  const href = `${ONBOARDING_TEMPLATES_HREF}/${encodeURIComponent(template.role)}`;
  return (
    <li>
      <div className="card">
        <div className="row-between">
          <span className="grow">{template.name}</span>
          <span className="badge badge-neutral">{taskCount(template.taskCount)}</span>
          {isHr ? (
            <a className="btn btn-secondary" href={href} aria-label={`Edit ${template.name} template`}>
              Edit
            </a>
          ) : (
            <a className="btn btn-secondary" href={href} aria-label={`View ${template.name} template`}>
              View
            </a>
          )}
        </div>
      </div>
    </li>
  );
}
