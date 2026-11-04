import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AccessRefused } from "./AccessRefused";

describe("AccessRefused", () => {
  it("is an alert with the heading, guidance and a staff sign-in link", () => {
    const html = renderToStaticMarkup(<AccessRefused reason="signed-out" />);
    expect(html).toContain('role="alert"');
    expect(html).toContain("<h1>Access refused</h1>");
    expect(html).toContain("Sign in with a staff account to open this page.");
    expect(html).toContain('href="/back-office/sign-in"');
    expect(html).toContain("btn btn-primary");
  });
});
