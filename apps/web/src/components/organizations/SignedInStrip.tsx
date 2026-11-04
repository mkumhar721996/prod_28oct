"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ROLE_LABELS, signOutUser, type CurrentUser, type Role } from "@/lib/orgSession";
import { NEW_ACCOUNT_HREF, ORG_SIGN_IN_HREF } from "@/lib/shell";

const ROLE_BADGE: Record<Role, string> = {
  super_admin: "badge-accent",
  staff: "badge-info",
  fundraising_consultant: "badge-success",
};

export const roleBadgeClass = (role: Role) => `badge ${ROLE_BADGE[role]}`;

/** Who is signed in, with one role badge. Only a super-admin is offered a way to create accounts. */
export function SignedInStrip({ user }: { user: CurrentUser }) {
  const router = useRouter();
  async function onSignOut() {
    await signOutUser();
    router.replace(ORG_SIGN_IN_HREF);
    router.refresh();
  }
  return (
    <div className="strip">
      <span className="row-inline">
        <span>{user.email}</span>
        <span className={roleBadgeClass(user.role)}>{ROLE_LABELS[user.role]}</span>
      </span>
      <span className="row-inline">
        {user.role === "super_admin" && (
          <Link className="btn btn-secondary btn-sm" href={NEW_ACCOUNT_HREF}>
            Manage accounts
          </Link>
        )}
        <button className="btn btn-ghost btn-sm" type="button" onClick={onSignOut}>
          Sign out
        </button>
      </span>
    </div>
  );
}
