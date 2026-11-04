"use client";

import { SignInForm } from "@/components/SignInForm";
import { signInUser } from "@/lib/orgSession";
import { ORGANIZATIONS_HREF } from "@/lib/shell";

export const ORG_SIGN_IN_REFUSAL = "Email or password is incorrect";
export const SESSION_ENDED_NOTICE = "Your session ended. Sign in again to continue.";

/** The shared sign-in form for staff, consultants and super-admins: no register link, one refusal message. */
export function OrgSignInForm({ sessionEnded = false }: { sessionEnded?: boolean }) {
  return (
    <SignInForm
      signIn={signInUser}
      redirectTo={ORGANIZATIONS_HREF}
      registerHref={null}
      refusalMessage={ORG_SIGN_IN_REFUSAL}
      notice={sessionEnded ? SESSION_ENDED_NOTICE : undefined}
    />
  );
}
