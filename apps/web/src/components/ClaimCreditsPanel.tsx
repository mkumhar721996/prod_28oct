"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { claimFreeCredits, type TopUp } from "@/lib/session";
import { formatCredits } from "./BalanceTile";

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
    message: `Free credits claimed: ${formatCredits(result.grantedCredits)}. Balance ${formatCredits(result.balanceCredits)}.`,
  };
}

export function ClaimCreditsPanel({
  balanceCredits,
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

  const disabled = !topUp.eligible || pending;

  return (
    <div className="card stack stack-2">
      <h2>Free credits</h2>
      <p>Your balance is {formatCredits(balanceCredits)}.</p>
      <p>
        <span className={`badge ${topUp.eligible ? "badge-success" : "badge-neutral"}`}>
          {topUp.eligible ? "Available" : "Not available"}
        </span>
      </p>
      <p className="text-sm text-muted">
        {topUp.eligible
          ? "Your balance is 1 credit or less, so you can claim free credits."
          : "Free credits are available when your balance is 1 credit or less."}
      </p>
      <p className="text-sm text-muted">A claim adds {formatCredits(topUp.credits)}.</p>
      <div>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={disabled}
          aria-disabled={disabled}
          onClick={claim}
        >
          {pending ? "Claiming…" : "Claim free credits"}
        </button>
      </div>
      {outcome?.ok && (
        <div className="alert alert-success" role="status">
          <span>{outcome.message}</span>
        </div>
      )}
      {outcome && !outcome.ok && (
        <div className="alert alert-danger" role="alert" tabIndex={-1} ref={failure}>
          <span>{outcome.message}</span>
        </div>
      )}
    </div>
  );
}
