import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { MyVerification } from "@/lib/identityVerifications";
import { ResubmitForm, validateDetails } from "./ResubmitForm";
import { VerificationStatusScreen } from "./VerificationStatusScreen";

vi.mock("next/headers", () => ({ cookies: async () => ({ toString: () => "" }) }));

const verification = (status: MyVerification["status"], extra: Partial<MyVerification> = {}): MyVerification => ({
  status,
  fullName: "Amara Newton",
  dateOfBirth: "1988-03-14",
  idNumber: "NX-402917",
  rejectionReason: null,
  ...extra,
});
const render = (v: MyVerification) => renderToStaticMarkup(<VerificationStatusScreen initial={v} />);

describe("VerificationStatusScreen", () => {
  it("pending shows the Pending badge and the submitted details", () => {
    const html = render(verification("pending"));
    expect(html).toContain("Identity verification");
    expect(html).toContain("Pending");
    expect(html).toContain("Your details are waiting for review.");
    expect(html).toContain("NX-402917");
  });

  it("rejected shows the staff reason and a resubmit button", () => {
    const html = render(verification("rejected", { rejectionReason: "Date of birth does not match the ID." }));
    expect(html).toContain("Your identity verification was rejected. Check the reason below and resubmit.");
    expect(html).toContain("Date of birth does not match the ID.");
    expect(html).toContain("Resubmit details");
  });

  it("approved offers the way to the accounts", () => {
    const html = render(verification("approved"));
    expect(html).toContain("You can now reach your accounts.");
    expect(html).toContain('href="/wallet"');
    expect(html).toContain("Go to my accounts");
  });

  it("a customer who never submitted gets a first-submit form", () => {
    const html = render(verification("none", { fullName: null, dateOfBirth: null, idNumber: null }));
    expect(html).toContain("Submit your details");
  });
});

describe("ResubmitForm", () => {
  const props = {
    heading: "Resubmit your details",
    initial: { fullName: "Amara Newton", dateOfBirth: "1988-03-14", idNumber: "NX-402917" },
    lastReason: "Date of birth does not match the ID.",
    onSubmitted: () => {},
    onCancel: () => {},
  };

  it("prefills the fields and shows the last reason", () => {
    const html = renderToStaticMarkup(<ResubmitForm {...props} />);
    expect(html).toContain('value="Amara Newton"');
    expect(html).toContain('value="1988-03-14"');
    expect(html).toContain('value="NX-402917"');
    expect(html).toContain("Last reason:");
    for (const label of ["Full name", "Date of birth", "ID number", "Cancel", "Submit"]) expect(html).toContain(label);
  });

  it("validateDetails flags every blank field", () => {
    expect(validateDetails({ fullName: " ", dateOfBirth: "", idNumber: "" })).toEqual({
      fullName: "Enter your full name.",
      dateOfBirth: "Enter your date of birth.",
      idNumber: "Enter your ID number.",
    });
    expect(validateDetails(props.initial)).toEqual({});
  });
});
