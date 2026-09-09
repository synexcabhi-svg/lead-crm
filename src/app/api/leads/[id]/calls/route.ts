/**
 * GET  /api/leads/:id/calls  - the lead's Calls related list
 * POST /api/leads/:id/calls  - log a call on the lead
 *
 * Access follows the lead: a Sales user can only see/add calls on leads they
 * own or are the Sales Team member for.
 */
import { handle, ok, created, notFound } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { assertOwnsRecord } from "@/lib/rbac";
import { getLead } from "@/domain/leads/lead.service";
import { callCreateSchema } from "@/domain/calls/call.schema";
import { listCallsForLead, createCall } from "@/domain/calls/call.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Ctx {
  params: { id: string };
}

export function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireUser();
    const lead = await getLead(params.id);
    if (!lead) throw notFound(`Lead ${params.id} not found`);
    assertOwnsRecord(user, lead);
    return ok(await listCallsForLead(params.id));
  });
}

export function POST(req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireUser();
    const lead = await getLead(params.id);
    if (!lead) throw notFound(`Lead ${params.id} not found`);
    assertOwnsRecord(user, lead);
    const input = callCreateSchema.parse(await req.json());
    const call = await createCall(params.id, input, user.id);
    return created({ call });
  });
}
