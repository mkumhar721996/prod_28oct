import { redirect } from "next/navigation";
import { OrganizationsScreen } from "@/components/organizations/OrganizationsScreen";
import { getOrganizations } from "@/lib/organizations";
import { getCurrentUser } from "@/lib/orgSession";
import { ORG_SIGN_IN_HREF } from "@/lib/shell";

export default async function OrganizationsPage() {
  // Decided on the server: a signed-out visitor is redirected before any organization is fetched or rendered.
  const user = await getCurrentUser();
  if (!user) redirect(ORG_SIGN_IN_HREF);
  const organizations = await getOrganizations();
  if (!organizations) redirect(ORG_SIGN_IN_HREF);
  return <OrganizationsScreen user={user} organizations={organizations} />;
}
