import { redirect } from "next/navigation";
import { HistoryScreen } from "@/components/history/HistoryScreen";
import { getSession, getWalletHistory } from "@/lib/session";
import { SIGN_IN_HREF } from "@/lib/shell";

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; range?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect(`${SIGN_IN_HREF}?next=history`);
  const { page, range } = await searchParams;
  const parsed = Number(page);
  const history = await getWalletHistory(
    Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : 1,
    range === "all" ? "all" : "recent",
  );
  return <HistoryScreen history={history} />;
}
