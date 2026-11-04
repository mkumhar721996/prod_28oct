import { redirect } from "next/navigation";
import { VerificationStatusScreen } from "@/components/identity-verifications/VerificationStatusScreen";
import { getMyVerification } from "@/lib/identityVerifications";
import { getSession } from "@/lib/session";
import { SIGN_IN_HREF } from "@/lib/shell";

export default async function IdentityVerificationPage() {
  // Signed-out visitors never get verification data; sign-in brings them back via `next`.
  if ((await getSession()) === null) {
    redirect(`${SIGN_IN_HREF}?next=identity-verification`);
  }
  return <VerificationStatusScreen initial={await getMyVerification()} />;
}
