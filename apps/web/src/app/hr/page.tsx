import Link from "next/link";
import { Suspense } from "react";
import { DashboardToast } from "@/components/dashboard-toast";
import { Icon } from "@/components/icon";
import type { Hire } from "@/lib/hires/validate";

export const dynamic = "force-dynamic";

const NEW_HIRE_HREF = "/hr/hires/new?from=/hr";

/** Returns null when the list could not be loaded, so an outage is not shown as "no hires". */
async function loadHires(): Promise<Hire[] | null> {
  try {
    const res = await fetch(`${process.env.RECORDS_API_URL ?? "http://localhost:4000"}/hires`, {
      cache: "no-store",
    });
    return res.ok ? ((await res.json()) as Hire[]) : null;
  } catch {
    return null;
  }
}

export default async function HrDashboard() {
  const hires = await loadHires();
  const isEmpty = hires !== null && hires.length === 0;
  return (
    <div className="stack stack-4">
      <div className="page-head">
        <h1>New hires</h1>
        {!isEmpty && (
          <Link className="btn btn-primary" href={NEW_HIRE_HREF}>
            <Icon name="plus" /> Add new hire
          </Link>
        )}
      </div>
      {hires === null && (
        <div className="alert alert-danger" role="alert">
          <Icon name="alert" />
          <span>
            We couldn&apos;t load the new hires. <Link href="/hr">Try again</Link>
          </span>
        </div>
      )}
      {isEmpty ? (
        <div className="empty-state card">
          <h2>No new hires yet</h2>
          <p className="text-muted">Add a hire and send their invite so onboarding can begin.</p>
          <Link className="btn btn-primary" href={NEW_HIRE_HREF}>
            Add new hire
          </Link>
        </div>
      ) : (
        // The hires table and 'Invited' status belong to the hires table story.
        <div data-slot="hires-table" />
      )}
      <Suspense>
        <DashboardToast />
      </Suspense>
    </div>
  );
}
