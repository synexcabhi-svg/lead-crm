import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ownsRecord, permissionFlags } from "@/lib/rbac";
import { getLead } from "@/domain/leads/lead.service";
import { getStatuses, getSources } from "@/domain/statuses/status.service";
import { getAssignablePeople } from "@/domain/people/people.service";
import { getDealStages } from "@/domain/deals/deal.stage.service";
import { getPropertyTypes } from "@/domain/property/property-type.service";
import { getLeadAuditTrail } from "@/domain/audit/audit.service";
import { listCallsForLead } from "@/domain/calls/call.service";
import { LeadDetailClient } from "./lead-detail-client";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const lead = await getLead(params.id);
  if (!lead) notFound();
  if (!ownsRecord(user, lead)) notFound();

  const [statuses, sources, people, dealStages, accounts, audit, calls, propertyTypes] = await Promise.all([
    getStatuses(),
    getSources(),
    getAssignablePeople(),
    getDealStages(),
    prisma.account.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" }, take: 500 }),
    getLeadAuditTrail(params.id),
    listCallsForLead(params.id),
    getPropertyTypes(),
  ]);
  const peopleOpts = people.map((p) => ({ id: p.id, name: p.name, color: p.color }));

  return (
    <LeadDetailClient
      lead={JSON.parse(JSON.stringify(lead))}
      audit={JSON.parse(JSON.stringify(audit))}
      calls={JSON.parse(JSON.stringify(calls))}
      perms={permissionFlags(user)}
      meta={{
        statuses: statuses.filter((s) => s.isActive).map((s) => ({ key: s.key, label: s.label })),
        sources: sources
          .filter((s) => s.isActive)
          .map((s) => ({ key: s.key, label: s.label, color: s.color })),
        owners: peopleOpts,
        technicalMembers: peopleOpts,
        dealStages: dealStages.filter((s) => s.isActive).map((s) => ({ key: s.key, label: s.label })),
        accounts,
        propertyTypes: propertyTypes
          .filter((p) => p.isActive)
          .map((p) => ({ key: p.key, label: p.label, category: p.category })),
      }}
    />
  );
}
