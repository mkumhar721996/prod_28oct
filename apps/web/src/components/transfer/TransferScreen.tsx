"use client";

import { useRef, useState } from "react";
import {
  ACCOUNT_LABELS,
  newIdempotencyKey,
  submitTransfer,
  type Account,
  type AccountBalance,
  type TransferInput,
} from "@/lib/accounts";
import { BalanceTile } from "../BalanceTile";

const AMOUNT_ERROR = "Enter a whole number of 1 or more.";
const SAME_ACCOUNT_ERROR = "Choose two different accounts.";

export type Validation = { amount?: number; amountError?: string; toError?: string };

/** Client-side checks only for what can be said before the server: the amount and the pair. */
export function validateTransfer(fromId: string, toId: string, amountText: string): Validation {
  const text = amountText.trim();
  const amount = /^\d+$/.test(text) ? Number(text) : NaN;
  const result: Validation = {};
  if (fromId === toId) result.toError = SAME_ACCOUNT_ERROR;
  if (Number.isSafeInteger(amount) && amount >= 1) result.amount = amount;
  else result.amountError = AMOUNT_ERROR;
  return result;
}

export type Outcome =
  | { view: "success"; from: AccountBalance; to: AccountBalance; reference: string }
  | { view: "refused"; message: string; frozen: "source" | "destination" | null };

const FROZEN_SIDE = { source_frozen: "source", destination_frozen: "destination" } as const;

/** Confirms once and turns the server's answer into what the screen shows. */
export async function runConfirm(
  deps: { submitTransfer: typeof submitTransfer },
  input: TransferInput,
): Promise<Outcome> {
  const result = await deps.submitTransfer(input);
  if (result.ok) {
    return { view: "success", from: result.from, to: result.to, reference: result.reference };
  }
  const frozen = result.reason && result.reason in FROZEN_SIDE
    ? FROZEN_SIDE[result.reason as keyof typeof FROZEN_SIDE]
    : null;
  return { view: "refused", message: result.message, frozen };
}

const optionLabel = (a: Account) => `${ACCOUNT_LABELS[a.kind]} (balance ${a.balance})`;

export function TransferReview({
  from,
  to,
  amount,
  pending,
  onEdit,
  onConfirm,
}: {
  from: Account;
  to: Account;
  amount: number;
  pending: boolean;
  onEdit?: () => void;
  onConfirm?: () => void;
}) {
  const fromLabel = ACCOUNT_LABELS[from.kind];
  const toLabel = ACCOUNT_LABELS[to.kind];
  return (
    <div className="stack">
      <h2>Review your transfer</h2>
      <div className="card" data-testid="review-summary">
        <div className="summary-row">
          <span>From</span>
          <strong>{fromLabel}</strong>
        </div>
        <div className="summary-row">
          <span>To</span>
          <strong>{toLabel}</strong>
        </div>
        <div className="summary-row">
          <span>Amount</span>
          <strong>{amount}</strong>
        </div>
      </div>
      <p className="text-muted">
        Nothing moves until you confirm. {fromLabel} {from.balance} and {toLabel} {to.balance} stay
        as they are.
      </p>
      <div className="actions actions-between">
        <button type="button" className="btn btn-secondary" onClick={onEdit} disabled={pending}>
          Edit
        </button>
        <button type="button" className="btn btn-primary" onClick={onConfirm} disabled={pending}>
          {pending ? "Confirming…" : "Confirm transfer"}
        </button>
      </div>
    </div>
  );
}

export function TransferResult({
  outcome,
  accounts,
  amount,
  fromId,
  toId,
  onReset,
}: {
  outcome: Outcome;
  accounts: Account[];
  amount: number;
  fromId: string;
  toId: string;
  onReset?: () => void;
}) {
  const nameOf = (id: string) => {
    const account = accounts.find((a) => a.id === id);
    return account ? ACCOUNT_LABELS[account.kind] : "";
  };
  const frozenId = outcome.view === "refused" && outcome.frozen
    ? outcome.frozen === "source" ? fromId : toId
    : null;
  const balanceOf = (a: Account) =>
    outcome.view === "success"
      ? ([outcome.from, outcome.to].find((b) => b.id === a.id)?.balance ?? a.balance)
      : a.balance;

  return (
    <div className="stack">
      {outcome.view === "success" ? (
        <div className="alert alert-success" role="status">
          Transfer complete. {amount} moved from {nameOf(fromId)} to {nameOf(toId)}.
        </div>
      ) : (
        <div
          className={`alert ${outcome.frozen ? "alert-warning" : "alert-danger"}`}
          role="alert"
        >
          {outcome.message}
        </div>
      )}
      <div className="pair">
        {accounts.map((a) => (
          <BalanceTile
            key={a.id}
            label={ACCOUNT_LABELS[a.kind]}
            amount={balanceOf(a)}
            frozen={a.id === frozenId}
          />
        ))}
      </div>
      {outcome.view === "success" ? (
        <p className="text-muted">
          Reference {outcome.reference}. If you submit this confirmation again, it is not applied a
          second time.
        </p>
      ) : (
        <p className="text-muted">Both balances are unchanged.</p>
      )}
      <div className="actions">
        <button
          type="button"
          className={`btn ${outcome.view === "success" ? "btn-primary" : "btn-secondary"}`}
          onClick={onReset}
        >
          {outcome.view === "success"
            ? "Make another transfer"
            : outcome.frozen
              ? "Change the accounts"
              : "Change the amount"}
        </button>
      </div>
    </div>
  );
}

type Step = "form" | "review" | "result";

export function TransferScreen({ accounts: initial }: { accounts: Account[] }) {
  const [accounts, setAccounts] = useState(initial);
  const [step, setStep] = useState<Step>("form");
  const [fromId, setFromId] = useState(initial[0]?.id ?? "");
  const [toId, setToId] = useState(initial[1]?.id ?? "");
  const [amountText, setAmountText] = useState("");
  const [errors, setErrors] = useState<Validation>({});
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [pending, setPending] = useState(false);
  // One key for the whole review, so a double click or a re-submit is applied once.
  const key = useRef("");
  const inFlight = useRef(false);

  const from = accounts.find((a) => a.id === fromId);
  const to = accounts.find((a) => a.id === toId);
  const amount = Number(amountText.trim());

  function proceed() {
    const checked = validateTransfer(fromId, toId, amountText);
    setErrors(checked);
    if (checked.amountError || checked.toError) return;
    key.current = newIdempotencyKey();
    setStep("review");
  }

  async function confirm() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    const next = await runConfirm(
      { submitTransfer },
      { fromAccountId: fromId, toAccountId: toId, amount, idempotencyKey: key.current },
    );
    if (next.view === "success") {
      setAccounts((all) =>
        all.map((a) => ({
          ...a,
          balance: [next.from, next.to].find((b) => b.id === a.id)?.balance ?? a.balance,
        })),
      );
    }
    setOutcome(next);
    setPending(false);
    inFlight.current = false;
    setStep("result");
  }

  if (!from || !to) return null;

  if (step === "review") {
    return (
      <TransferReview
        from={from}
        to={to}
        amount={amount}
        pending={pending}
        onEdit={() => setStep("form")}
        onConfirm={confirm}
      />
    );
  }

  if (step === "result" && outcome) {
    return (
      <TransferResult
        outcome={outcome}
        accounts={accounts}
        amount={amount}
        fromId={fromId}
        toId={toId}
        onReset={() => {
          setAmountText("");
          setOutcome(null);
          setStep("form");
        }}
      />
    );
  }

  return (
    <div className="stack">
      <form
        id="transfer-form"
        className="card stack transfer-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          proceed();
        }}
      >
        <div className="field">
          <label htmlFor="from-account">From account</label>
          <select
            id="from-account"
            className="select"
            value={fromId}
            onChange={(e) => setFromId(e.target.value)}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {optionLabel(a)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="to-account">To account</label>
          <select
            id="to-account"
            className={`select${errors.toError ? " is-invalid" : ""}`}
            value={toId}
            aria-invalid={errors.toError ? true : undefined}
            aria-describedby={errors.toError ? "to-error" : undefined}
            onChange={(e) => setToId(e.target.value)}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {optionLabel(a)}
              </option>
            ))}
          </select>
          {errors.toError && (
            <p className="field-error" id="to-error">
              {errors.toError}
            </p>
          )}
        </div>
        <div className="field">
          <label htmlFor="amount">Amount</label>
          <input
            id="amount"
            name="amount"
            className={`input${errors.amountError ? " is-invalid" : ""}`}
            inputMode="decimal"
            autoComplete="off"
            value={amountText}
            aria-invalid={errors.amountError ? true : undefined}
            aria-describedby={errors.amountError ? "amount-error" : "amount-hint"}
            onChange={(e) => setAmountText(e.target.value)}
          />
          {errors.amountError ? (
            <p className="field-error" id="amount-error">
              {errors.amountError}
            </p>
          ) : (
            <p className="field-hint" id="amount-hint">
              Enter an amount up to the balance of the from account.
            </p>
          )}
        </div>
      </form>
      <div className="actions">
        <button type="submit" form="transfer-form" className="btn btn-primary">
          Continue
        </button>
      </div>
    </div>
  );
}
