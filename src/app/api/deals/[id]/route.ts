import { handle, ok, notFound, forbidden } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { assertOwnsRecord, can } from "@/lib/rbac";
import { dealUpdateSchema } from "@/domain/deals/deal.schema";
import { getDeal, updateDeal, deleteDeal } from "@/domain/deals/deal.service";
import { getDealAuditTrail } from "@/domain/audit/audit.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Ctx {
  params: { id: string };
}

export async function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireUser();
    const deal = await getDeal(params.id);
    if (!deal) throw notFound(`Deal ${params.id} not found`);
    assertOwnsRecord(user, deal);
    const audit = await getDealAuditTrail(params.id);
    return ok({ deal, audit });
  });
}

async function apply(req: Request, params: Ctx["params"]) {
  const user = await requireUser();
  const current = await getDeal(params.id);
  if (!current) throw notFound(`Deal ${params.id} not found`);
  assertOwnsRecord(user, current);

  const input = dealUpdateSchema.parse(await req.json());
  if (input.ownerId !== undefined && input.ownerId !== (current.ownerId ?? "") && !can.reassignOwner(user)) {
    throw forbidden("Only a Manager or above can change the record Owner");
  }

  const deal = await updateDeal(params.id, input, {
    actor: { kind: "user", userId: user.id, label: user.email },
  });
  return ok({ deal });
}

export function PUT(req: Request, { params }: Ctx) {
  return handle(() => apply(req, params));
}
export function PATCH(req: Request, { params }: Ctx) {
  return handle(() => apply(req, params));
}

export function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireUser();
    if (!can.deleteDeal(user)) throw forbidden("Only a Manager or above can delete a deal");
    await deleteDeal(params.id, { actor: { kind: "user", userId: user.id, label: user.email } });
    return ok({ deleted: true, id: params.id });
  });
}
