import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/accounts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/accounts")>()),
  submitTransfer: vi.fn(),
}));

import type { Account } from "@/lib/accounts";
import {
  TransferResult,
  TransferReview,
  TransferScreen,
  runConfirm,
  validateTransfer,
} from "./TransferScreen";

const accounts: Account[] = [
  { id: "c", kind: "checking", balance: 200, frozen: false },
  { id: "s", kind: "savings", balance: 100, frozen: false },
];
const input = { fromAccountId: "c", toAccountId: "s", amount: 50, idempotencyKey: "k1" };

describe("TransferScreen form", () => {
  const html = renderToStaticMarkup(<TransferScreen accounts={accounts} />);

  it("AC1/AC2: shows both balances in the selects, the hint and one primary Continue", () => {
    expect(html).toContain(">Checking (balance 200)<");
    expect(html).toContain(">Savings (balance 100)<");
    expect(html).toContain("Enter an amount up to the balance of the from account.");
    expect(html).toContain('inputMode="decimal"');
    expect(html.match(/btn-primary/g)).toHaveLength(1);
    expect(html).toContain(">Continue<");
    expect(html).not.toContain("Review your transfer");
  });

  it("starts with checking as the from account and savings as the to account", () => {
    expect(html).toMatch(/<option value="c" selected="">Checking/);
    expect(html).toMatch(/<option value="s" selected="">Savings/);
  });
});

describe("validateTransfer", () => {
  it("AC1: accepts checking to savings of 50", () => {
    expect(validateTransfer("c", "s", "50")).toEqual({ amount: 50 });
  });

  it.each(["", "0", "-5", "1.5", "abc", "1e3", "9999999999999999999"])(
    "rejects the amount %j with a field error",
    (text) => {
      expect(validateTransfer("c", "s", text).amountError).toMatch(/whole number/);
    },
  );

  it("rejects the same account twice", () => {
    expect(validateTransfer("c", "c", "50").toError).toMatch(/different/);
  });
});

describe("TransferReview", () => {
  const html = renderToStaticMarkup(
    <TransferReview from={accounts[0]} to={accounts[1]} amount={50} pending={false} />,
  );

  it("AC1/AC2: summarises from, to and amount and says nothing moves yet", () => {
    expect(html).toContain("Review your transfer");
    expect(html).toContain('data-testid="review-summary"');
    expect(html).toContain("<span>From</span><strong>Checking</strong>");
    expect(html).toContain("<span>To</span><strong>Savings</strong>");
    expect(html).toContain("<span>Amount</span><strong>50</strong>");
    expect(html).toContain("Nothing moves until you confirm. Checking 200 and Savings 100 stay as they are.");
    expect(html).toContain(">Edit<");
    expect(html).toContain(">Confirm transfer<");
  });

  it("disables Confirm while pending", () => {
    const pending = renderToStaticMarkup(
      <TransferReview from={accounts[0]} to={accounts[1]} amount={50} pending />,
    );
    expect(pending).toMatch(/<button[^>]*disabled=""[^>]*>Confirming…<\/button>/);
  });
});

describe("runConfirm", () => {
  it("AC3/AC4: success carries the server's balances", async () => {
    const submitTransfer = vi.fn(async () => ({
      ok: true as const,
      from: { id: "c", balance: 150 },
      to: { id: "s", balance: 200 },
      reference: "TRF-1",
      replayed: false,
    }));
    const out = await runConfirm({ submitTransfer }, input);
    expect(out).toMatchObject({ view: "success", from: { balance: 150 }, to: { balance: 200 } });
    expect(submitTransfer).toHaveBeenCalledWith(input);
  });

  it.each([
    ["insufficient_balance", "refused", null],
    ["source_frozen", "refused", "source"],
    ["destination_frozen", "refused", "destination"],
  ] as const)("AC5-AC8: %s is a refusal with the server message", async (reason, view, frozen) => {
    const submitTransfer = vi.fn(async () => ({ ok: false as const, reason, message: "Transfer not made. X" }));
    expect(await runConfirm({ submitTransfer }, input)).toEqual({
      view,
      message: "Transfer not made. X",
      frozen,
    });
  });

  it("a network failure is a plain refusal with the retry message", async () => {
    const submitTransfer = vi.fn(async () => ({ ok: false as const, message: "Couldn't make the transfer. Try again." }));
    expect(await runConfirm({ submitTransfer }, input)).toMatchObject({
      view: "refused",
      message: "Couldn't make the transfer. Try again.",
    });
  });
});

describe("TransferResult", () => {
  it("AC3/AC4: success shows both balances live, with a status message and no alert", () => {
    const html = renderToStaticMarkup(
      <TransferResult
        outcome={{
          view: "success",
          from: { id: "c", balance: 150 },
          to: { id: "s", balance: 200 },
          reference: "TRF-1",
        }}
        accounts={accounts}
        amount={50}
        fromId="c"
        toId="s"
      />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain("Transfer complete. 50 moved from Checking to Savings.");
    expect(html).toMatch(/aria-live="polite">150</);
    expect(html).toMatch(/aria-live="polite">200</);
    expect(html).toContain("Reference TRF-1");
    expect(html).toContain(">Make another transfer<");
    expect(html).not.toContain('role="alert"');
  });

  it("AC5/AC9: a refusal is the one alert, with unchanged balances and no status or toast", () => {
    const html = renderToStaticMarkup(
      <TransferResult
        outcome={{ view: "refused", message: "Transfer not made. Checking does not have 150 available.", frozen: null }}
        accounts={accounts}
        amount={150}
        fromId="c"
        toId="s"
      />,
    );
    expect(html.match(/role="alert"/g)).toHaveLength(1);
    expect(html).toContain("alert-danger");
    expect(html).toContain("Transfer not made.");
    expect(html).not.toContain('role="status"');
    expect(html).not.toContain("toast");
    expect(html).toContain("Both balances are unchanged.");
    expect(html).toMatch(/>200</);
    expect(html).toMatch(/>100</);
    expect(html).toContain(">Change the amount<");
  });

  it.each([
    ["source", "Checking"],
    ["destination", "Savings"],
  ] as const)("AC7/AC8: a frozen %s shows the Frozen badge on %s", (frozen, label) => {
    const html = renderToStaticMarkup(
      <TransferResult
        outcome={{ view: "refused", message: "Transfer not made. Frozen.", frozen }}
        accounts={accounts}
        amount={50}
        fromId="c"
        toId="s"
      />,
    );
    expect(html).toContain("alert-warning");
    expect(html).toContain('role="alert"');
    expect(html).toContain(`${label} <span class="badge badge-warning">Frozen</span>`);
    expect(html.match(/badge-warning/g)).toHaveLength(1);
    expect(html).toContain(">Change the accounts<");
  });
});
