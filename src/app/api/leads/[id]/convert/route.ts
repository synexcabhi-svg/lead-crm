/**
 * POST /api/leads/:id/convert - convert a (converted-status) lead into an
 * Account + Contact + optional Deal. See src/domain/leads/lead.convert.ts.
 */
import { handle, ok, notFound } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { assertOwnsRecord } from "@/lib/rbac";
import { convertLeadSchema } from "@/domain/deals/deal.schema";
import { convertLead } from "@/domain/leads/lead.convert";
import { getLead } from "@/domain/leads/lead.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requireUser();
    const lead = await getLead(params.id);
    if (!lead) throw notFound(`Lead ${params.id} not found`);
    assertOwnsRecord(user, lead);
    const input = convertLeadSchema.parse(await req.json().catch(() => ({})));
    const result = await convertLead(params.id, input, {
      actor: { kind: "user", userId: user.id, label: user.email },
    });
    return ok({
      leadId: params.id,
      accountId: result.accountId,
      accountCreated: result.accountCreated,
      contactId: result.contactId,
      deal: result.deal,
    });
  });
}
