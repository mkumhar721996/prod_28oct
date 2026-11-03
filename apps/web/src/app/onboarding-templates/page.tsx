import { redirect } from "next/navigation";
import { TemplatesScreen } from "@/components/onboarding-templates/TemplatesScreen";
import { getTemplates } from "@/lib/onboardingTemplates";
import { getSession } from "@/lib/session";
import { ONBOARDING_TEMPLATES_HREF, SIGN_IN_HREF } from "@/lib/shell";

export default async function OnboardingTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  // Signed-out visitors never get template data; sign-in brings them back via `next`.
  const session = await getSession();
  if (session === null) {
    redirect(`${SIGN_IN_HREF}?next=${encodeURIComponent(ONBOARDING_TEMPLATES_HREF)}`);
  }
  const [{ saved }, templates] = await Promise.all([searchParams, getTemplates()]);
  // The toast names the role from the saved list, so ?saved=anything-else shows nothing.
  const savedName = templates.find((t) => t.role === saved)?.name;
  return <TemplatesScreen templates={templates} isHr={session.role === "hr"} savedName={savedName} />;
}
