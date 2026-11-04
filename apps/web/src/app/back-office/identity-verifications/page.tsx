import { AccessRefused } from "@/components/back-office/AccessRefused";
import { VerificationsScreen } from "@/components/identity-verifications/VerificationsScreen";
import { getDecidedSubmissions, getPendingSubmissions } from "@/lib/identityVerifications";
import { getStaffAccess } from "@/lib/staffSession";

export default async function IdentityVerificationsPage() {
  // The decision is made on the server, so refused visitors never receive submission data.
  const access = await getStaffAccess();
  if (access.status !== "staff") return <AccessRefused reason={access.reason} />;
  const [pending, decided] = await Promise.all([getPendingSubmissions(), getDecidedSubmissions()]);
  return <VerificationsScreen initialPending={pending} initialDecided={decided} />;
}
