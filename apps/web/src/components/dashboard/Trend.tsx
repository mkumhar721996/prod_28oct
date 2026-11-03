import type { ReactNode } from "react";

/** An up or down figure: the ▲/▼ marker always accompanies the colour. */
export function Trend({ up, children }: { up: boolean; children: ReactNode }) {
  return (
    <span className={up ? "up" : "down"}>
      {up ? "▲" : "▼"} {children}
    </span>
  );
}
