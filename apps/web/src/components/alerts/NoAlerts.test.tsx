import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NoAlerts } from "./NoAlerts";

describe("NoAlerts", () => {
  it("says there are no alerts yet with one way back home", () => {
    const html = renderToStaticMarkup(<NoAlerts />);
    expect(html).toContain("No alerts yet");
    expect(html).toContain("When you receive money, you&#x27;ll see it here.");
    expect(html).toMatch(/<a[^>]*href="\/"[^>]*>Back to home</);
  });
});
