/**
 * GET /api/meta - dropdown data for the forms and filters. `owners` and
 * `technicalMembers` are the SAME list now (the People list), so the Owner
 * and Sales Team pickers show the same names.
 */
import { handle, ok } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStatuses, getSources } from "@/domain/statuses/status.service";
import { getDealStages } from "@/domain/deals/deal.stage.service";
import { getAssignablePeople } from "@/domain/people/people.service";
import { getPropertyTypes } from "@/domain/property/property-type.service";
import { LEAD_PRIORITIES } from "@/domain/leads/lead.constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return handle(async () => {
    await requireUser();
    const [statuses, sources, people, dealStages, accounts, propertyTypes] = await Promise.all([
      getStatuses(),
      getSources(),
      getAssignablePeople(),
      getDealStages(),
      prisma.account.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" }, take: 500 }),
      getPropertyTypes(),
    ]);
    return ok({
      statuses: statuses.filter((s) => s.isActive),
      sources: sources.filter((s) => s.isActive),
      people,
      owners: people,
      technicalMembers: people,
      dealStages: dealStages.filter((s) => s.isActive),
      accounts,
      propertyTypes: propertyTypes.filter((p) => p.isActive),
      priorities: LEAD_PRIORITIES,
    });
  });
}
