import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Toast, TOAST_MS } from "./Toast";

describe("Toast", () => {
  it("hides after four seconds", () => {
    expect(TOAST_MS).toBe(4000);
  });

  it("defaults to a status toast with the check icon", () => {
    const html = renderToStaticMarkup(<Toast message="Saved" />);
    expect(html).toContain('role="status"');
    expect(html).toContain("M20 6 9 17l-5-5");
  });

  it("AC10: can be an alert with the alert icon", () => {
    const html = renderToStaticMarkup(
      <Toast message="Your balance does not cover this bet" icon="alert" role="alert" />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("M12 16h.01");
    expect(html).toContain("Your balance does not cover this bet");
  });
});
