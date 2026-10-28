"use client";

import { useEffect, useState } from "react";

const FORMAT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
};

/** The UTC text rendered first, so server and client markup match. */
export const utcText = (iso: string) =>
  `${new Intl.DateTimeFormat("en-US", { ...FORMAT, timeZone: "UTC" }).format(new Date(iso))} UTC`;

/** The time in the viewer's zone (or `timeZone`, for tests); the UTC text when Intl fails. */
export function localText(iso: string, timeZone?: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { ...FORMAT, timeZone }).format(new Date(iso));
  } catch {
    return utcText(iso);
  }
}

/** Entries are stored in UTC; this shows them in the viewer's local time zone once mounted. */
export function LocalTime({ iso }: { iso: string }) {
  const [text, setText] = useState(() => utcText(iso));
  useEffect(() => setText(localText(iso)), [iso]);
  return <time dateTime={iso}>{text}</time>;
}
