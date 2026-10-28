import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LocalTime, localText, utcText } from "./LocalTime";

const ISO = "2026-10-28T14:30:00.000Z";

describe("LocalTime", () => {
  it("renders UTC text first, with the ISO string in dateTime", () => {
    const html = renderToStaticMarkup(<LocalTime iso={ISO} />);
    expect(html).toContain('dateTime="2026-10-28T14:30:00.000Z"');
    expect(html).toContain("Oct 28, 14:30 UTC");
  });

  it("formats in the viewer's zone", () => {
    expect(utcText(ISO)).toBe("Oct 28, 14:30 UTC");
    expect(localText(ISO, "Asia/Kolkata")).toBe("Oct 28, 20:00");
  });

  it("falls back to UTC text when the zone is unusable", () => {
    expect(localText(ISO, "Not/AZone")).toBe("Oct 28, 14:30 UTC");
  });
});
