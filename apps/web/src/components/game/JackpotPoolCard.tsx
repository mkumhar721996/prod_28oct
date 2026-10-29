"use client";

import { useState } from "react";
import { formatCents, type JackpotCents } from "@/lib/game";

const TIERS: readonly { id: string; label: string; key: keyof Omit<JackpotCents, "totalCents"> }[] = [
  { id: "mini", label: "Mini", key: "miniCents" },
  { id: "minor", label: "Minor", key: "minorCents" },
  { id: "major", label: "Major", key: "majorCents" },
  { id: "grand", label: "Grand", key: "grandCents" },
];

export function JackpotPoolCard({ jackpot }: { jackpot: JackpotCents }) {
  const [open, setOpen] = useState(false);
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
        aria-controls="pool-tiers"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? "Hide pool split" : "Show pool split"}
      </button>
      <dl className="tiers" id="pool-tiers" hidden={!open}>
        {TIERS.map((t) => (
          <div key={t.id}>
            <dt>{t.label}</dt>
            <dd>{formatCents(jackpot[t.key])}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
