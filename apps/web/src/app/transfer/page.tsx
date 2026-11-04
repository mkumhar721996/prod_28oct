import { redirect } from "next/navigation";
import { TransferScreen } from "@/components/transfer/TransferScreen";
import { getAccounts } from "@/lib/accounts";
import { getSession } from "@/lib/session";
import { SIGN_IN_HREF } from "@/lib/shell";

export default async function TransferPage() {
  const session = await getSession();
  if (!session) redirect(`${SIGN_IN_HREF}?next=transfer`);
  const accounts = await getAccounts();
  return (
    <div className="narrow stack stack-4">
      <h1>Transfer between your accounts</h1>
      <p className="text-muted">
        Move money between your checking and savings accounts. Transfers are instant.
      </p>
      <TransferScreen accounts={accounts} />
    </div>
  );
}
