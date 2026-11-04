"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Toast } from "@/components/appointments/Toast";
import { Icon } from "@/components/orders/Icon";
import { checkSession, type CurrentUser } from "@/lib/orgSession";
import {
  deleteOrganization,
  saveOrganization,
  type ActionResult,
  type Organization,
} from "@/lib/organizations";
import { ORGANIZATIONS_HREF, ORG_SIGN_IN_HREF } from "@/lib/shell";
import { SignedInStrip } from "./SignedInStrip";

const SESSION_CHECK_MS = 60_000;
const SESSION_ENDED_HREF = `${ORG_SIGN_IN_HREF}?reason=expired`;

export type SaveOutcome =
  | { kind: "invalid"; error: string }
  | { kind: "ended" }
  | { kind: "failed"; message: string }
  | { kind: "done"; value: Organization };

type SaveDeps = { saveOrganization: typeof saveOrganization };

/** Validates, then stores the edit. A 401 means the session ended: the draft is not kept. */
export async function saveDraft(
  deps: SaveDeps,
  id: string,
  draft: { name: string; address: string },
): Promise<SaveOutcome> {
  const name = draft.name.trim();
  if (!name) return { kind: "invalid", error: "Enter a name" };
  const result = await deps.saveOrganization(id, { name, address: draft.address.trim() });
  return outcome(result);
}

export async function removeOrganization(
  deps: { deleteOrganization: typeof deleteOrganization },
  id: string,
): Promise<SaveOutcome | { kind: "done"; value: undefined }> {
  return outcome(await deps.deleteOrganization(id));
}

function outcome<T>(result: ActionResult<T>): { kind: "done"; value: T } | SaveOutcome {
  if (result.ok) return { kind: "done", value: result.value };
  if (result.status === 401) return { kind: "ended" };
  return { kind: "failed", message: result.message };
}

/**
 * The organization's saved details, an edit form (staff, consultants and super-admins) and, for a
 * super-admin only, Delete. The draft lives only in this component's state: never in storage or a
 * URL, so an ended session leaves nothing but the last saved details.
 */
export function OrganizationScreen({
  user,
  organization,
}: {
  user: CurrentUser;
  organization: Organization;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(organization);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(organization.name);
  const [address, setAddress] = useState(organization.address);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // The session ends server side; notice it on focus and every minute, and leave the draft behind.
  useEffect(() => {
    const check = async () => {
      if ((await checkSession()).status === 401) router.replace(SESSION_ENDED_HREF);
    };
    const timer = setInterval(check, SESSION_CHECK_MS);
    window.addEventListener("focus", check);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", check);
    };
  }, [router]);

  function startEdit() {
    setName(saved.name);
    setAddress(saved.address);
    setError(null);
    setEditing(true);
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const result = await saveDraft({ saveOrganization }, saved.id, { name, address });
    setPending(false);
    if (result.kind === "ended") return router.replace(SESSION_ENDED_HREF);
    if (result.kind === "invalid") return setError(result.error);
    if (result.kind === "failed") return setError(result.message);
    setSaved(result.value);
    setEditing(false);
    setToast("Changes saved");
  }

  async function onDelete() {
    setPending(true);
    const result = await removeOrganization({ deleteOrganization }, saved.id);
    setPending(false);
    if (result.kind === "ended") return router.replace(SESSION_ENDED_HREF);
    if (result.kind === "failed") {
      setConfirmingDelete(false);
      return setError(result.message);
    }
    router.replace(ORGANIZATIONS_HREF);
    router.refresh();
  }

  return (
    <div className="wide stack stack-4">
      <SignedInStrip user={user} />
      {toast && <Toast message={toast} onHide={() => setToast(null)} />}
      {editing ? (
        <form className="card stack" onSubmit={onSave} noValidate>
          <h1>Edit organization</h1>
          <div className="field">
            <label htmlFor="org-name">Name</label>
            <input
              className={error ? "input is-invalid" : "input"}
              id="org-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "org-err" : undefined}
            />
            {error && (
              <p className="field-error row-inline" id="org-err" role="alert">
                <Icon name="alert" />
                <span>{error}</span>
              </p>
            )}
          </div>
          <div className="field">
            <label htmlFor="org-address">Address</label>
            <input
              className="input"
              id="org-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <div className="row-inline">
            <button className="btn btn-primary" type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <section className="card stack">
          <div className="row-between">
            <h1>{saved.name}</h1>
            <span className="row-inline">
              <button className="btn btn-secondary" type="button" onClick={startEdit}>
                Edit organization
              </button>
              {user.role === "super_admin" && (
                <button
                  className="btn btn-danger"
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                >
                  Delete organization
                </button>
              )}
            </span>
          </div>
          {error && (
            <div className="alert alert-danger" role="alert">
              <Icon name="alert" />
              <span>{error}</span>
            </div>
          )}
          {confirmingDelete && (
            <div className="alert alert-danger stack stack-2" role="alertdialog" aria-label="Confirm delete">
              <span>Delete {saved.name}? This cannot be undone.</span>
              <span className="row-inline">
                <button className="btn btn-danger btn-sm" type="button" onClick={onDelete} disabled={pending}>
                  Confirm delete
                </button>
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => setConfirmingDelete(false)}>
                  Cancel
                </button>
              </span>
            </div>
          )}
          <dl className="dl">
            <dt>Address</dt>
            <dd>{saved.address || "No address saved"}</dd>
          </dl>
        </section>
      )}
    </div>
  );
}
