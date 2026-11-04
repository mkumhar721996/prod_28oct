import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Submission } from "@/lib/identityVerifications";
import { DecidedList } from "./DecidedList";
import { ReviewPanel } from "./ReviewPanel";
import { SubmissionCard } from "./SubmissionCard";
import {
  ALREADY_DECIDED,
  REASON_REQUIRED,
  VerificationsScreen,
  removeSubmission,
  runDecision,
  validateReason,
} from "./VerificationsScreen";

vi.mock("next/headers", () => ({ cookies: async () => ({ toString: () => "" }) }));

const sub = (id: string, fullName: string, idNumber: string, extra: Partial<Submission> = {}): Submission => ({
  id,
  fullName,
  dateOfBirth: "1988-03-14",
  idNumber,
  status: "pending",
  rejectionReason: null,
  decidedBy: null,
  decidedAt: null,
  submittedAt: "2026-11-03T09:00:00.000Z",
  ...extra,
});
const amara = sub("a", "Amara Newton", "NX-402917");
const tomasz = sub("b", "Tomasz Villanueva", "PV-118305");

describe("SubmissionCard", () => {
  const html = renderToStaticMarkup(<SubmissionCard submission={amara} onReview={() => {}} />);

  it("shows full name, date of birth and ID number", () => {
    for (const label of ["Full name", "Date of birth", "ID number"]) expect(html).toContain(label);
    expect(html).toContain("Amara Newton");
    expect(html).toContain("14 Mar 1988");
    expect(html).toContain("NX-402917");
  });

  it("has a Review button named for the customer", () => {
    expect(html).toContain('aria-label="Review Amara Newton"');
  });
});

describe("VerificationsScreen", () => {
  it("lists every pending submission", () => {
    const html = renderToStaticMarkup(<VerificationsScreen initialPending={[amara, tomasz]} initialDecided={[]} />);
    expect(html).toContain("Identity verifications");
    expect(html).toContain("NX-402917");
    expect(html).toContain("PV-118305");
  });

  it("shows the empty state when nothing is pending", () => {
    const html = renderToStaticMarkup(<VerificationsScreen initialPending={[]} initialDecided={[]} />);
    expect(html).toContain("No pending verifications");
    expect(html).toContain("See decided submissions");
  });

  it("removes a decided submission from the list", () => {
    expect(removeSubmission([amara, tomasz], "a")).toEqual([tomasz]);
  });
});

describe("rejecting needs a reason", () => {
  it("validateReason refuses blank and whitespace", () => {
    expect(validateReason("  ")).toBe(REASON_REQUIRED);
    expect(REASON_REQUIRED).toBe("Enter a reason to reject this verification. It stays pending.");
    expect(validateReason(" Bad ID ")).toBeNull();
  });

  it("runDecision sends nothing for a blank reason", async () => {
    const approve = vi.fn();
    const reject = vi.fn();
    const out = await runDecision({ id: "a", decision: { kind: "reject", reason: "  " }, approve, reject });
    expect(out).toEqual({ ok: false, reason: "blank", message: REASON_REQUIRED });
    expect(reject).not.toHaveBeenCalled();
  });

  it("runDecision approves and rejects through the API helpers", async () => {
    const approve = vi.fn(async () => ({ ok: true as const }));
    const reject = vi.fn(async () => ({ ok: true as const }));
    await expect(runDecision({ id: "a", decision: { kind: "approve" }, approve, reject })).resolves.toEqual({ ok: true });
    await runDecision({ id: "a", decision: { kind: "reject", reason: " Bad ID " }, approve, reject });
    expect(reject).toHaveBeenCalledWith("a", "Bad ID");
  });

  it("passes an already-decided refusal through", async () => {
    const refusal = { ok: false as const, reason: "already-decided" as const, message: ALREADY_DECIDED };
    const out = await runDecision({ id: "a", decision: { kind: "approve" }, approve: async () => refusal, reject: vi.fn() });
    expect(out).toEqual(refusal);
    expect(ALREADY_DECIDED).toBe(
      "This submission was already decided by another staff member. Your action was not applied.",
    );
  });
});

describe("ReviewPanel", () => {
  const noop = () => {};
  const props = { queue: [amara, tomasz], selected: amara, busy: false, onBack: noop, onApprove: noop, onReject: noop };

  it("shows the reason field, hint and the three actions", () => {
    const html = renderToStaticMarkup(<ReviewPanel {...props} />);
    expect(html).toContain("Reason for rejection");
    expect(html).toContain("The customer sees this reason on their status page.");
    for (const label of ["Back to list", "Reject", "Approve"]) expect(html).toContain(label);
    expect(html).not.toContain("aria-invalid");
  });

  it("marks the reason invalid and announces the error", () => {
    const html = renderToStaticMarkup(<ReviewPanel {...props} initialError={REASON_REQUIRED} />);
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="reason-error"');
    expect(html).toContain('role="alert"');
    expect(html).toContain(REASON_REQUIRED);
  });
});

describe("DecidedList", () => {
  const decided = [
    sub("1", "Amara Newton", "NX-402917", {
      status: "approved",
      decidedBy: "lee.park@example.com",
      decidedAt: "2026-11-03T15:42:00.000Z",
    }),
    sub("2", "Priya Shah", "GH-557203", {
      status: "rejected",
      rejectionReason: "ID number does not match the ID.",
      decidedBy: "sam.okafor@example.com",
      decidedAt: "2026-11-03T14:08:00.000Z",
    }),
  ];

  it("shows who decided, when, the reason and the decision word", () => {
    const html = renderToStaticMarkup(<DecidedList submissions={decided} />);
    expect(html).toContain("Decided by");
    expect(html).toContain("lee.park@example.com");
    expect(html).toContain("Decided at");
    expect(html).toContain("ID number does not match the ID.");
    expect(html).toContain("Approved");
    expect(html).toContain("Rejected");
  });
});
