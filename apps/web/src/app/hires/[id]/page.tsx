import { notFound, redirect } from "next/navigation";
import { HireRecordScreen } from "@/components/hires/HireRecordScreen";
import { getHire, getManagers } from "@/lib/hires";
import { getSession } from "@/lib/session";
import { HIRES_HREF, SIGN_IN_HREF } from "@/lib/shell";

export default async function HireRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (session === null) {
    redirect(`${SIGN_IN_HREF}?next=${encodeURIComponent(`${HIRES_HREF}/${id}`)}`);
  }
  const [hire, managers] = await Promise.all([getHire(id), getManagers()]);
  if (hire === null) notFound();
  return <HireRecordScreen hire={hire} managers={managers} />;
}
