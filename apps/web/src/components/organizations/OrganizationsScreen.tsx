import Link from "next/link";
import type { CurrentUser } from "@/lib/orgSession";
import type { OrganizationSummary } from "@/lib/organizations";
import { ORGANIZATIONS_HREF } from "@/lib/shell";
import { SignedInStrip } from "./SignedInStrip";

export function OrganizationsScreen({
  user,
  organizations,
}: {
  user: CurrentUser;
  organizations: OrganizationSummary[];
}) {
  return (
    <div className="wide stack stack-4">
      <SignedInStrip user={user} />
      <h1>Organizations</h1>
      {organizations.length === 0 ? (
        <div className="empty-state">
          <h2>No organizations yet</h2>
          <p>Organizations you add will be listed here.</p>
        </div>
      ) : (
        <ul className="list">
          {organizations.map((organization) => (
            <li className="card" key={organization.id}>
              <Link className="link" href={`${ORGANIZATIONS_HREF}/${organization.id}`}>
                {organization.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
