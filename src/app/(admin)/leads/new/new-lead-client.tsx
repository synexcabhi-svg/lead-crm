"use client";

import { useRouter } from "next/navigation";
import { LeadForm, type LeadFormMeta } from "@/components/LeadForm";

export function NewLeadClient({ meta }: { meta: LeadFormMeta }) {
  const router = useRouter();
  return (
    <LeadForm
      mode="create"
      meta={meta}
      onSuccess={({ id }) => {
        router.push(id ? `/leads/${id}` : "/leads");
        router.refresh();
      }}
    />
  );
}
