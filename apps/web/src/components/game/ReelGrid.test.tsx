import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReelGrid } from "./ReelGrid";

describe("ReelGrid", () => {
  it("AC2: shows the three symbols once the reels stop", () => {
    const html = renderToStaticMarkup(<ReelGrid symbols={["cherry", "bell", "seven"]} spinning={false} frame={0} />);
    expect(html.match(/role="img"/g)).toHaveLength(3);
    expect(html).toContain('aria-label="Reel 1">🍒<');
    expect(html).toContain('aria-label="Reel 2">🔔<');
    expect(html).toContain('aria-label="Reel 3">7<');
    expect(html).not.toContain("is-spinning");
  });

  it("renders BAR as text", () => {
    expect(renderToStaticMarkup(<ReelGrid symbols={["bar", "bar", "bar"]} spinning={false} frame={0} />)).toContain(">BAR<");
  });

  it("AC2: spinning reels are labelled and marked, and cycle with the frame", () => {
    const at = (frame: number) => renderToStaticMarkup(<ReelGrid symbols={["bar", "bar", "bar"]} spinning frame={frame} />);
    const html = at(0);
    expect(html.match(/is-spinning/g)).toHaveLength(3);
    expect(html).toContain('aria-label="Reel 1 spinning"');
    expect(html).not.toContain("BAR");
    expect(at(1)).not.toBe(html);
  });
});
