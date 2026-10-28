import { appTitle } from "@/lib/title";

export default function Home() {
  return <h1 className="text-3xl font-semibold">{appTitle()}</h1>;
}
