import { handle, ok } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { removeDealContact } from "@/domain/deals/deal.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function DELETE(_req: Request, { params }: { params: { id: string; contactId: string } }) {
  return handle(async () => {
    const user = await requireUser();
    const deal = await removeDealContact(params.id, params.contactId, {
      actor: { kind: "user", userId: user.id, label: user.email },
    });
    return ok({ deal });
  });
}
