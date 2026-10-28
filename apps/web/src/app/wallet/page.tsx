import { redirect } from "next/navigation";
import { BalanceTile } from "@/components/BalanceTile";
import { getSession, getWalletBalance } from "@/lib/session";
import { SIGN_IN_HREF } from "@/lib/shell";

export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect(`${SIGN_IN_HREF}?next=wallet`);
  const [{ welcome }, balance] = await Promise.all([searchParams, getWalletBalance()]);
  return (
    <div className="narrow stack stack-4">
      <h1>Wallet</h1>
      {welcome === "1" && (
        <div className="alert alert-success" role="status">
          <span>Welcome! We added 1,000 credits to your new wallet.</span>
        </div>
      )}
      <BalanceTile credits={balance} email={session.email} />
    </div>
  );
}
