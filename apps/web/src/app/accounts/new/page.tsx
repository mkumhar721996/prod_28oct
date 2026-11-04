import Link from "next/link";
import { redirect } from "next/navigation";
import { NewAccountForm } from "@/components/organizations/NewAccountForm";
import { getAccounts } from "@/lib/organizations";
import { getCurrentUser } from "@/lib/orgSession";
import { ORGANIZATIONS_HREF, ORG_SIGN_IN_HREF } from "@/lib/shell";

export default async function NewAccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect(ORG_SIGN_IN_HREF);
  // Only a super-admin gets the form; everyone else gets this notice and no account markup.
  if (user.role !== "super_admin") {
    return (
      <div className="empty-state" role="alert">
        <h1>Access refused</h1>
        <p>Only a super-admin can create accounts.</p>
        <Link className="btn btn-primary" href={ORGANIZATIONS_HREF}>
          Back to organizations
        </Link>
      </div>
    );
  }
  const accounts = await getAccounts();
  if (!accounts) redirect(ORG_SIGN_IN_HREF);
  return <NewAccountForm user={user} accounts={accounts} />;
}
