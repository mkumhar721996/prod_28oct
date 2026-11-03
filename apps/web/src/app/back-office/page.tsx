import { AccessRefused } from "@/components/back-office/AccessRefused";
import { BackOfficeHome } from "@/components/back-office/BackOfficeHome";
import { getStaffAccess } from "@/lib/staffSession";

export default async function BackOfficePage() {
  // The decision is made on the server, so refused visitors never receive back-office markup.
  const access = await getStaffAccess();
  if (access.status !== "staff") return <AccessRefused reason={access.reason} />;
  return <BackOfficeHome />;
}
