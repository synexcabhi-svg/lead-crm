import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ownsRecord, permissionFlags } from "@/lib/rbac";
import { getDeal } from "@/domain/deals/deal.service";
import { getDealStages } from "@/domain/deals/deal.stage.service";
import { getAssignablePeople } from "@/domain/people/people.service";
import { getDealAuditTrail } from "@/domain/audit/audit.service";
import { DealDetailClient } from "./deal-detail-client";

export const dynamic = "force-dynamic";

export default async function DealDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const deal = await getDeal(params.id);
  if (!deal) notFound();
  if (!ownsRecord(user, deal)) notFound();

  const [stages, people, contacts, audit] = await Promise.all([
    getDealStages(),
    getAssignablePeople(),
    prisma.contact.findMany({
      where: { accountId: deal.accountId },
      select: { id: true, firstName: true, lastName: true },
    }),
    getDealAuditTrail(params.id),
  ]);
  const peopleOpts = people.map((p) => ({ id: p.id, name: p.name, color: p.color }));

  return (
    <DealDetailClient
      deal={JSON.parse(JSON.stringify(deal))}
      audit={JSON.parse(JSON.stringify(audit))}
      perms={permissionFlags(user)}
      meta={{
        stages: stages.filter((s) => s.isActive).map((s) => ({ key: s.key, label: s.label })),
        owners: peopleOpts,
        technicalMembers: peopleOpts,
        contacts: contacts.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName ?? ""}`.trim() })),
      }}
    />
  );
}
