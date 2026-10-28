import { appTitle } from "@/lib/title";

export default function Home() {
  return (
    <div className="page-head">
      <h1>{appTitle()}</h1>
    </div>
  );
}
