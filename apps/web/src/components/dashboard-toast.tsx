"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";

const TOAST_MS = 4000;

export function DashboardToast() {
  const router = useRouter();
  const invited = useSearchParams().get("invited");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!invited) return;
    setMessage(`Invite queued for ${invited}`);
    // Strip the query so a reload or back navigation does not replay the toast.
    router.replace("/hr");
  }, [invited, router]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [message]);

  if (!message) return null;
  return (
    <div className="toast is-open" role="status">
      <Icon name="check" />
      <span>{message}</span>
    </div>
  );
}
