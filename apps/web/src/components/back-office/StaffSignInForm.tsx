"use client";

import { SignInForm } from "@/components/SignInForm";
import { BACK_OFFICE_HREF, STAFF_REGISTER_HREF } from "@/lib/shell";
import { signInStaff } from "@/lib/staffSession";

export const STAFF_REFUSAL = "Sign-in refused. Check your details or contact an administrator.";

/** The customer sign-in form pointed at the staff sign-in (a client component, so it can hold the function props). */
export function StaffSignInForm() {
  return (
    <SignInForm
      title="Staff sign in"
      signIn={signInStaff}
      redirectTo={BACK_OFFICE_HREF}
      registerHref={STAFF_REGISTER_HREF}
      registerPrompt="No staff account?"
      registerLabel="Register"
      refusalMessage={STAFF_REFUSAL}
    />
  );
}
