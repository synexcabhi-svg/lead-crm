import { requireUser } from "@/lib/auth";
import { leadScopeWhere, permissionFlags } from "@/lib/rbac";
import { listLeads } from "@/domain/leads/lead.service";
import { getStatuses, getSources } from "@/domain/statuses/status.service";
import { getAssignablePeople } from "@/domain/people/people.service";
import { leadListQuerySchema } from "@/domain/leads/lead.schema";
import { LeadsClient } from "./leads-client";

export const dynamic = "force-dynamic";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await requireUser();
  const query = leadListQuerySchema.parse(searchParams);
  const [result, statuses, sources, people] = await Promise.all([
    listLeads(query, leadScopeWhere(user)),
    getStatuses(),
    getSources(),
    getAssignablePeople(),
  ]);

  const peopleOpts = people.map((p) => ({ id: p.id, name: p.name, color: p.color }));

  return (
    <LeadsClient
      initial={result}
      query={query}
      perms={permissionFlags(user)}
      meta={{
        statuses: statuses.map((s) => ({ key: s.key, label: s.label })),
        sources: sources.map((s) => ({ key: s.key, label: s.label, color: s.color })),
        owners: peopleOpts,
        technicalMembers: peopleOpts,
      }}
    />
  );
}
