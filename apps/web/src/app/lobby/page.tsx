import { LobbyScreen } from "@/components/lobby/LobbyScreen";
import { getSession } from "@/lib/session";

/** Public: guests browse the lobby without signing in. */
export default async function LobbyPage() {
  let signedIn = false;
  try {
    signedIn = (await getSession()) !== null;
  } catch {
    // Treat a failing session lookup as a guest, like Menu.
  }
  return <LobbyScreen signedIn={signedIn} />;
}
