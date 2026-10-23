import { appTitle } from "@/lib/title";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <h1 className="text-3xl font-semibold">{appTitle()}</h1>
    </main>
  );
}
