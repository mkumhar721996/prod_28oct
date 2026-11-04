"use client";

import { useCallback, useEffect, useState } from "react";
import {
  freezeAccount,
  reasonError,
  searchAccounts,
  unfreezeAccount,
  type StaffAccount,
} from "@/lib/staffAccounts";
import { Toast } from "../appointments/Toast";
import { AccountPanel, accountTitle, type PanelView } from "./AccountPanel";

type Load = "loading" | "ready" | "error";

export const LOAD_ERROR = "The accounts could not be loaded. Check your connection and try again.";

/** Staff find one account, then freeze it with a reason or unfreeze it. */
export function AccountsScreen() {
  const [query, setQuery] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [load, setLoad] = useState<Load>("loading");
  const [accounts, setAccounts] = useState<StaffAccount[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<PanelView>("current");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const hideToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    let current = true;
    setLoad("loading");
    searchAccounts(query)
      .then((found) => {
        if (!current) return;
        setAccounts(found);
        setLoad("ready");
      })
      .catch(() => current && setLoad("error"));
    return () => {
      current = false;
    };
  }, [query, attempt]);

  const selected = accounts.find((a) => a.id === selectedId) ?? accounts[0] ?? null;

  function select(id: string) {
    setSelectedId(id);
    setView("current");
    setReason("");
    setError(null);
  }

  function replace(updated: StaffAccount) {
    setAccounts((list) => list.map((a) => (a.id === updated.id ? updated : a)));
  }

  async function onFreeze() {
    if (!selected) return;
    const problem = reasonError(reason);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    const result = await freezeAccount(selected.id, reason);
    setBusy(false);
    if (result.ok) {
      replace(result.account);
      setReason("");
      setError(null);
    } else if (result.kind === "reason_required") {
      setError(result.message);
    } else {
      setToast(result.message);
    }
  }

  async function onUnfreeze() {
    if (!selected) return;
    setBusy(true);
    const result = await unfreezeAccount(selected.id);
    setBusy(false);
    if (result.ok) {
      replace(result.account);
      setView("unfrozen");
    } else {
      setToast(result.message);
    }
  }

  return (
    <div className="workspace">
      <div className="search-col stack-2">
        <h1>Accounts</h1>
        <div className="field">
          <label htmlFor="find-account">Find an account</label>
          <input
            className="input"
            id="find-account"
            type="search"
            value={query}
            placeholder="Email or account number"
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {load === "ready" && accounts.length > 0 && (
          <ul className="result-list" aria-label="Matching accounts">
            {accounts.map((a) => (
              <li key={a.id}>
                <button
                  className="result"
                  type="button"
                  aria-current={a.id === selected?.id ? "true" : undefined}
                  onClick={() => select(a.id)}
                >
                  <span>{accountTitle(a)}</span>
                  <span className={a.frozen ? "badge badge-danger" : "badge badge-success"}>
                    {a.frozen ? "Frozen" : "Active"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="detail-col stack-2">
        {load === "loading" && (
          <div className="card stack-2" role="status" aria-label="Loading accounts" aria-busy="true">
            <div className="skeleton skeleton-title" />
            <div className="skeleton" />
            <div className="skeleton skeleton-block" />
          </div>
        )}
        {load === "error" && (
          <div className="stack-2">
            <div className="alert alert-danger" role="alert">
              {LOAD_ERROR}
            </div>
            <div className="form-actions">
              <button className="btn btn-secondary" type="button" onClick={() => setAttempt((n) => n + 1)}>
                Try again
              </button>
            </div>
          </div>
        )}
        {load === "ready" && !selected && (
          <div className="empty-state">
            <p>No accounts match &quot;{query}&quot;. Check the spelling or try the account number.</p>
            <button className="btn btn-primary" type="button" onClick={() => setQuery("")}>
              Clear search
            </button>
          </div>
        )}
        {load === "ready" && selected && (
          <AccountPanel
            key={selected.id}
            account={selected}
            view={view}
            reason={reason}
            reasonError={error}
            busy={busy}
            onReasonChange={setReason}
            onFreeze={onFreeze}
            onUnfreeze={onUnfreeze}
            onBackToForm={() => setView("current")}
          />
        )}
      </div>
      {toast && <Toast message={toast} onHide={hideToast} />}
    </div>
  );
}
