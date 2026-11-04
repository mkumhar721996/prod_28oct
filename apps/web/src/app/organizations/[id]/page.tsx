import { notFound, redirect } from "next/navigation";
import { OrganizationScreen } from "@/components/organizations/OrganizationScreen";
import { getOrganization } from "@/lib/organizations";
import { getCurrentUser } from "@/lib/orgSession";
import { ORG_SIGN_IN_HREF } from "@/lib/shell";

export default async function OrganizationPage({ params }: { params: Promise<{ id: string }> }) {
  // Signed out gives a redirect and no markup; the organization is not even fetched.
  const user = await getCurrentUser();
  if (!user) redirect(ORG_SIGN_IN_HREF);
  const { id } = await params;
  const organization = await getOrganization(id);
  if (!organization) notFound();
  return <OrganizationScreen user={user} organization={organization} />;
}
