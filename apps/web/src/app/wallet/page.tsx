import { redirect } from "next/navigation";
import { BalanceTile } from "@/components/BalanceTile";
import { ClaimCreditsPanel } from "@/components/ClaimCreditsPanel";
import { getSession, getWallet } from "@/lib/session";
import { SIGN_IN_HREF } from "@/lib/shell";

export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect(`${SIGN_IN_HREF}?next=wallet`);
  const [{ welcome }, wallet] = await Promise.all([searchParams, getWallet()]);
  return (
    <div className="narrow stack stack-4">
      <h1>Wallet</h1>
      {welcome === "1" && (
        <div className="alert alert-success" role="status">
          <span>Welcome! We added 1,000 credits to your new wallet.</span>
        </div>
      )}
      <BalanceTile credits={wallet.balanceCredits} email={session.email} />
      <ClaimCreditsPanel balanceCredits={wallet.balanceCredits} topUp={wallet.topUp} />
    </div>
  );
}
