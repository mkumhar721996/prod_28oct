import { notFound, redirect } from "next/navigation";
import { ReadOnlyTemplate } from "@/components/onboarding-templates/ReadOnlyTemplate";
import { TemplateEditor } from "@/components/onboarding-templates/TemplateEditor";
import { getTemplate } from "@/lib/onboardingTemplates";
import { getSession } from "@/lib/session";
import { ONBOARDING_TEMPLATES_HREF, SIGN_IN_HREF } from "@/lib/shell";

export default async function OnboardingTemplatePage({
  params,
}: {
  params: Promise<{ role: string }>;
}) {
  const session = await getSession();
  if (session === null) {
    redirect(`${SIGN_IN_HREF}?next=${encodeURIComponent(ONBOARDING_TEMPLATES_HREF)}`);
  }
  const template = await getTemplate((await params).role);
  if (template === null) notFound();
  // HR gets the editor, everyone else the read-only view; the API enforces the same on writes.
  if (session.role !== "hr") return <ReadOnlyTemplate template={template} />;
  return (
    <TemplateEditor
      role={template.role}
      name={template.name}
      planCount={template.planCount}
      initialTasks={template.tasks}
      mode="edit"
    />
  );
}
