import { redirect } from "next/navigation";
import { AlertsScreen } from "@/components/alerts/AlertsScreen";
import { getAlerts } from "@/lib/alerts";
import { getSession } from "@/lib/session";
import { SIGN_IN_HREF } from "@/lib/shell";

export default async function AlertsPage() {
  // Signed-out visitors never get alert data; sign-in brings them back via `next`.
  if ((await getSession()) === null) {
    redirect(`${SIGN_IN_HREF}?next=alerts`);
  }
  return <AlertsScreen initialAlerts={await getAlerts()} />;
}
