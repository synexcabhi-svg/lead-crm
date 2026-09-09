import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { dealScopeWhere } from "@/lib/rbac";
import { listDeals } from "@/domain/deals/deal.service";
import { getDealStages } from "@/domain/deals/deal.stage.service";
import { getAssignablePeople } from "@/domain/people/people.service";
import { dealListQuerySchema } from "@/domain/deals/deal.schema";
import { DealsClient } from "./deals-client";

export const dynamic = "force-dynamic";

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await requireUser();
  const query = dealListQuerySchema.parse(searchParams);
  const [result, stages, people, accounts] = await Promise.all([
    listDeals(query, dealScopeWhere(user)),
    getDealStages(),
    getAssignablePeople(),
    prisma.account.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" }, take: 500 }),
  ]);
  const peopleOpts = people.map((p) => ({ id: p.id, name: p.name, color: p.color }));

  return (
    <DealsClient
      initial={result}
      query={query}
      meta={{
        stages: stages.filter((s) => s.isActive).map((s) => ({ key: s.key, label: s.label })),
        owners: peopleOpts,
        technicalMembers: peopleOpts,
        accounts,
      }}
    />
  );
}
