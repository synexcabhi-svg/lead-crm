/**
 * GET    /api/leads/:id  - one lead + audit trail
 * PUT    /api/leads/:id  - full update (same validation as create)
 * PATCH  /api/leads/:id  - partial update (status change, assign, etc.)
 * DELETE /api/leads/:id  - archive (default) or hard delete (?hard=true, ADMIN+)
 *
 * Sales users may only touch leads they own or are the Sales Team member for,
 * and may not change the Owner.
 */
import { handle, ok, notFound, forbidden } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { assertOwnsRecord, can } from "@/lib/rbac";
import { leadUpdateSchema } from "@/domain/leads/lead.schema";
import { getLead, updateLead, archiveLead, deleteLead } from "@/domain/leads/lead.service";
import { getLeadAuditTrail } from "@/domain/audit/audit.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Ctx {
  params: { id: string };
}

export async function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireUser();
    const lead = await getLead(params.id);
    if (!lead) throw notFound(`Lead ${params.id} not found`);
    assertOwnsRecord(user, lead);
    const audit = await getLeadAuditTrail(params.id);
    return ok({ lead, audit });
  });
}

async function applyUpdate(req: Request, params: Ctx["params"]) {
  const user = await requireUser();
  const current = await getLead(params.id);
  if (!current) throw notFound(`Lead ${params.id} not found`);
  assertOwnsRecord(user, current);

  const input = leadUpdateSchema.parse(await req.json());

  if (input.ownerId !== undefined && input.ownerId !== (current.ownerId ?? "") && !can.reassignOwner(user)) {
    throw forbidden("Only a Manager or above can change the record Owner");
  }
  if (
    input.technicalMemberId !== undefined &&
    input.technicalMemberId !== (current.technicalMemberId ?? "") &&
    !can.reassignOwner(user) &&
    input.technicalMemberId !== user.id
  ) {
    throw forbidden("You can only assign leads to yourself");
  }

  const lead = await updateLead(params.id, input, {
    actor: { kind: "user", userId: user.id, label: user.email },
  });
  return ok({ lead });
}

export function PUT(req: Request, { params }: Ctx) {
  return handle(() => applyUpdate(req, params));
}
export function PATCH(req: Request, { params }: Ctx) {
  return handle(() => applyUpdate(req, params));
}

export async function DELETE(req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireUser();
    const current = await getLead(params.id);
    if (!current) throw notFound(`Lead ${params.id} not found`);

    const hard = new URL(req.url).searchParams.get("hard") === "true";
    const actor = { kind: "user" as const, userId: user.id, label: user.email };

    if (hard) {
      if (!can.hardDeleteLead(user)) throw forbidden("Only an Admin or above can permanently delete a lead");
      await deleteLead(params.id, { actor });
      return ok({ deleted: true, id: params.id });
    }
    assertOwnsRecord(user, current);
    const lead = await archiveLead(params.id, { actor });
    return ok({ archived: true, lead });
  });
}
