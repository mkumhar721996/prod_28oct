import { OrgSignInForm } from "@/components/organizations/OrgSignInForm";

export default async function OrgSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  return <OrgSignInForm sessionEnded={reason === "expired"} />;
}
