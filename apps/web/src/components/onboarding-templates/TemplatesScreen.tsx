"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { TemplateSummary } from "@/lib/onboardingTemplates";
import { NEW_ONBOARDING_TEMPLATE_HREF, ONBOARDING_TEMPLATES_HREF } from "@/lib/shell";
import { Toast } from "../appointments/Toast";
import { Icon } from "../orders/Icon";
import { TemplateRoleRow } from "./TemplateRoleRow";

type Props = {
  templates: TemplateSummary[];
  isHr: boolean;
  /** Name of the role whose template was just saved: shows the toast once. */
  savedName?: string;
};

export function TemplatesScreen({ templates, isHr, savedName }: Props) {
  const router = useRouter();
  const [toast, setToast] = useState(savedName !== undefined);
  const hideToast = useCallback(() => setToast(false), []);

  // The toast shows once: drop ?saved so a refresh does not repeat it.
  useEffect(() => {
    if (savedName !== undefined) router.replace(ONBOARDING_TEMPLATES_HREF);
  }, [savedName, router]);

  return (
    <div className="stack stack-4">
      <div className="page-head">
        <h1>Onboarding templates</h1>
        {isHr && (
          <a className="btn btn-primary" href={NEW_ONBOARDING_TEMPLATE_HREF}>
            <Icon name="plus" />
            New template
          </a>
        )}
      </div>
      <p className="text-muted">
        One standard checklist per role, from pre-boarding to day 90. Changes apply to new hire plans
        only.
      </p>
      {templates.length > 0 ? (
        <ul className="list" aria-label="Role templates">
          {templates.map((t) => (
            <TemplateRoleRow key={t.role} template={t} isHr={isHr} />
          ))}
        </ul>
      ) : (
        <div className="empty-state">
          <h2>No templates yet</h2>
          <p>Create one per role so every hire starts from the same checklist.</p>
          {isHr && (
            <a className="btn btn-primary" href={NEW_ONBOARDING_TEMPLATE_HREF}>
              New template
            </a>
          )}
        </div>
      )}
      {toast && savedName !== undefined && (
        <Toast message={`${savedName} template saved`} onHide={hideToast} />
      )}
    </div>
  );
}
