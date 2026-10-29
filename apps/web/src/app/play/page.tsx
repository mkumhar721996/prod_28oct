import { redirect } from "next/navigation";
import { GameScreen } from "@/components/game/GameScreen";
import { getGame } from "@/lib/game";
import { getSession } from "@/lib/session";
import { SIGN_IN_HREF } from "@/lib/shell";

export default async function PlayPage() {
  const session = await getSession();
  if (!session) redirect(`${SIGN_IN_HREF}?next=play`);
  const state = await getGame();
  return <GameScreen initial={state} />;
}
