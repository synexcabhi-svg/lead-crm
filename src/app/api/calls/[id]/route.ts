/**
 * PATCH  /api/calls/:id  - edit a logged call
 * DELETE /api/calls/:id  - remove a logged call
 *
 * Access follows the call's lead.
 */
import { handle, ok, notFound } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { assertOwnsRecord } from "@/lib/rbac";
import { callUpdateSchema } from "@/domain/calls/call.schema";
import { getCall, updateCall, deleteCall } from "@/domain/calls/call.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Ctx {
  params: { id: string };
}

export function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireUser();
    const call = await getCall(params.id);
    if (!call) throw notFound("Call not found");
    assertOwnsRecord(user, call.lead);
    const input = callUpdateSchema.parse(await req.json());
    return ok({ call: await updateCall(params.id, input) });
  });
}

export function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireUser();
    const call = await getCall(params.id);
    if (!call) throw notFound("Call not found");
    assertOwnsRecord(user, call.lead);
    await deleteCall(params.id);
    return ok({ deleted: true, id: params.id });
  });
}
