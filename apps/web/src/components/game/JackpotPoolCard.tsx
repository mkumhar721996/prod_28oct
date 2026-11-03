"use client";

import { useId, useState } from "react";
import { formatCents, type JackpotCents } from "@/lib/game";

export function JackpotPoolCard({ jackpot }: { jackpot: JackpotCents }) {
  const [open, setOpen] = useState(false);
  const tiersId = useId();
  const tiers = [
    ["Mini", jackpot.miniCents],
    ["Minor", jackpot.minorCents],
    ["Major", jackpot.majorCents],
    ["Grand", jackpot.grandCents],
  ] as const;
  return (
    <section className="card jackpot" aria-label="Jackpot pool">
      <div className="jackpot-top">
        <span className="text-sm text-muted">Jackpot pool</span>
        <strong className="jackpot-total">{formatCents(jackpot.totalCents)}</strong>
      </div>
      <button
        className="btn btn-ghost btn-sm"
        type="button"
        aria-expanded={open}
        aria-controls={tiersId}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Hide pool split" : "Show pool split"}
      </button>
      <dl className="tiers" id={tiersId} hidden={!open}>
        {tiers.map(([name, cents]) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd>{formatCents(cents)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
