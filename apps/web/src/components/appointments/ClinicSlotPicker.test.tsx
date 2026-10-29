import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ClinicSlotPicker } from "./ClinicSlotPicker";

const days = [
  { date: "2026-11-02", times: ["09:00", "09:30"] },
  { date: "2026-11-09", times: ["10:00"] },
];
const render = (props: Partial<React.ComponentProps<typeof ClinicSlotPicker>>) =>
  renderToStaticMarkup(
    <ClinicSlotPicker
      clinicChosen
      status="ready"
      days={days}
      selected={null}
      onSelect={() => {}}
      {...props}
    />,
  );

describe("ClinicSlotPicker", () => {
  it("asks for a clinic first", () => {
    const html = render({ clinicChosen: false, days: [] });
    expect(html).toContain("Choose a clinic to see free times.");
    expect(html).not.toContain("chip");
  });

  it("shows skeleton lines while loading", () => {
    expect(render({ status: "loading" })).toContain("skeleton");
  });

  it("groups chips by labelled day", () => {
    const html = render({});
    expect(html).toContain(">Mon 2 Nov<");
    expect(html).toContain(">Mon 9 Nov<");
    expect(html.match(/role="group"/g)).toHaveLength(3); // Time group plus two days
    expect(html.match(/class="chip"/g)).toHaveLength(3);
  });

  it("marks only the selected chip pressed", () => {
    const html = render({ selected: { date: "2026-11-02", time: "09:30" } });
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-pressed="true"[^>]*>09:30</);
  });

  it("explains an empty or failed load", () => {
    expect(render({ days: [] })).toContain("No free times");
    expect(render({ status: "error" })).toContain("couldn&#x27;t load free times");
  });
});
