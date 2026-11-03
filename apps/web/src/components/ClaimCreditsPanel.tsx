"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { claimFreeCredits, type TopUp } from "@/lib/session";
import { formatCredits } from "./BalanceTile";
import { Toast } from "./appointments/Toast";

type Outcome = { ok: true; message: string } | { ok: false; message: string };

const CLAIM_FAILED = "Couldn't claim free credits. Try again.";

/** Claims, then refreshes the server data on success; the outcome is what the panel shows. */
export async function runClaim(deps: {
  claimFreeCredits: typeof claimFreeCredits;
  refresh: () => void;
}): Promise<Outcome> {
  const result = await deps.claimFreeCredits();
  if (!result.ok) return { ok: false, message: result.message ?? CLAIM_FAILED };
  deps.refresh();
  return {
    ok: true,
    message: `Free top-up added: ${formatCredits(result.grantedCredits)}`,
  };
}

export function ClaimCreditsPanel({
  topUp,
}: {
  balanceCredits: number;
  topUp: TopUp;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const failure = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (outcome && !outcome.ok) failure.current?.focus();
  }, [outcome]);

  async function claim() {
    setPending(true);
    setOutcome(null);
    const next = await runClaim({ claimFreeCredits, refresh: router.refresh });
    setPending(false);
    setOutcome(next);
  }

  return (
    <div className="card stack stack-2">
      <h2>Free credits</h2>
      {topUp.eligible ? (
        <>
          <p>Your balance is too low to bet. Claim a free top-up to keep playing.</p>
          <div>
            <button type="button" className="btn btn-primary" disabled={pending} onClick={claim}>
              {pending ? "Claiming…" : "Claim free top-up"}
            </button>
          </div>
        </>
      ) : (
        <p>You have enough credits to place a bet.</p>
      )}
      {outcome?.ok && <Toast inline message={outcome.message} />}
      {outcome && !outcome.ok && (
        <div tabIndex={-1} ref={failure}>
          <Toast inline tone="error" message={outcome.message} />
        </div>
      )}
    </div>
  );
}
