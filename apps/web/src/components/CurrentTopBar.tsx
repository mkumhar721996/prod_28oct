"use client";

import { usePathname } from "next/navigation";
import { TopBar } from "./TopBar";

/** The layout has no pathname on the server, so this reads it on the client for the nav highlight. */
export function CurrentTopBar({ signedIn }: { signedIn: boolean }) {
  return <TopBar signedIn={signedIn} pathname={usePathname()} />;
}
