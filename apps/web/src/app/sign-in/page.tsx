import { AccountScreen } from "@/components/AccountScreen";
import { signInTarget } from "@/lib/shell";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <AccountScreen
      initialMode="sign-in"
      redirected={next === "wallet"}
      redirectTo={signInTarget(next)}
    />
  );
}
