import Link from "next/link";
import { STAFF_SIGN_IN_HREF } from "@/lib/shell";
import type { StaffAccess } from "@/lib/staffSession";

type RefusedReason = Extract<StaffAccess, { status: "refused" }>["reason"];

export const REFUSED_REASONS: Record<RefusedReason, string> = {
  "signed-out": "You are signed out, so the back-office page was not shown.",
  customer: "Customer accounts cannot open back-office pages.",
  expired: "Your session ended after 15 minutes without activity.",
};

/** The only thing a visitor without a staff session receives; no back-office content is rendered. */
export function AccessRefused({ reason }: { reason: RefusedReason }) {
  return (
    <div className="empty-state" role="alert">
      <h1>Access refused</h1>
      <p>Sign in with a staff account to open this page.</p>
      <p className="text-sm">{REFUSED_REASONS[reason]}</p>
      <Link className="btn btn-primary" href={STAFF_SIGN_IN_HREF}>
        Staff sign in
      </Link>
    </div>
  );
}
