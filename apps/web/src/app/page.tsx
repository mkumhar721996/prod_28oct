import { redirect } from "next/navigation";
import { StocksDashboard } from "@/components/dashboard/StocksDashboard";
import { getSession } from "@/lib/session";
import { SIGN_IN_HREF } from "@/lib/shell";

export default async function Home() {
  if (!(await getSession())) redirect(SIGN_IN_HREF);
  return <StocksDashboard />;
}
