import { Suspense } from "react";
import { AddHireForm } from "@/components/add-hire-form";

export default function NewHirePage() {
  return (
    <Suspense>
      <AddHireForm />
    </Suspense>
  );
}
