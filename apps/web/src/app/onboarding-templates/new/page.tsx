import { redirect } from "next/navigation";
import { NewTemplateForm, roleExistsError } from "@/components/onboarding-templates/NewTemplateForm";
import { TemplateEditor } from "@/components/onboarding-templates/TemplateEditor";
import { getRoles, getTemplates } from "@/lib/onboardingTemplates";
import { getSession } from "@/lib/session";
import {
  NEW_ONBOARDING_TEMPLATE_HREF,
  ONBOARDING_TEMPLATES_HREF,
  SIGN_IN_HREF,
} from "@/lib/shell";

/** Step 1 chooses the role; with ?role=<slug> step 2 is the editor for a new template. HR only. */
export default async function NewOnboardingTemplatePage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const session = await getSession();
  if (session === null) {
    redirect(`${SIGN_IN_HREF}?next=${encodeURIComponent(NEW_ONBOARDING_TEMPLATE_HREF)}`);
  }
  // The API refuses writes from anyone else; this keeps non-HR users off the screen.
  if (session.role !== "hr") redirect(ONBOARDING_TEMPLATES_HREF);

  const [{ role }, roles, templates] = await Promise.all([searchParams, getRoles(), getTemplates()]);
  const chosen = roles.find((r) => r.role === role);
  if (chosen && !templates.some((t) => t.role === chosen.role)) {
    return (
      <TemplateEditor role={chosen.role} name={chosen.name} planCount={0} initialTasks={[]} mode="create" />
    );
  }
  return (
    <NewTemplateForm
      roles={roles}
      existing={templates}
      initialError={chosen ? roleExistsError(chosen.name) : undefined}
    />
  );
}
