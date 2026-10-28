import type { Hire, HireErrors, HireInput } from "./validate";

export type SendInviteResult =
  | { ok: true; hire: Hire }
  | { ok: false; status: number; errors: HireErrors; formError?: string };

const FORM_ERROR = "We couldn't send the invite. Try again.";

/** Never throws: every failure is returned as a value so the form handles errors in one place. */
export async function sendInvite(input: HireInput): Promise<SendInviteResult> {
  let status = 0;
  try {
    const res = await fetch("/api/hires", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    status = res.status;
    const body = await res.json();
    if (status === 201) return { ok: true, hire: body as Hire };
    if ((status === 400 || status === 409) && body && typeof body.errors === "object") {
      return { ok: false, status, errors: body.errors as HireErrors };
    }
  } catch {
    // fall through to the generic failure
  }
  return { ok: false, status, errors: {}, formError: FORM_ERROR };
}
