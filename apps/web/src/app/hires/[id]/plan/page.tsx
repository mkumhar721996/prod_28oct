import { notFound, redirect } from "next/navigation";
import { HirePlanScreen } from "@/components/hires/HirePlanScreen";
import { getHire, getPlan } from "@/lib/hires";
import { getSession } from "@/lib/session";
import { HIRES_HREF, SIGN_IN_HREF } from "@/lib/shell";

export default async function HirePlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (session === null) {
    redirect(`${SIGN_IN_HREF}?next=${encodeURIComponent(`${HIRES_HREF}/${id}/plan`)}`);
  }
  const hire = await getHire(id);
  if (hire === null) notFound();
  const plan = await getPlan(id);
  // A hire with no plan has nothing to show here; the record is where the plan gets created.
  if (plan === null) redirect(`${HIRES_HREF}/${id}`);
  return <HirePlanScreen hireId={id} plan={plan} />;
}
