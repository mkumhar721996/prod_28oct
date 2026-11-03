import { LobbyScreen } from "@/components/lobby/LobbyScreen";
import { getSession } from "@/lib/session";

/** Public: guests browse the lobby without signing in. */
export default async function LobbyPage() {
  const session = await getSession();
  return <LobbyScreen signedIn={session !== null} />;
}
