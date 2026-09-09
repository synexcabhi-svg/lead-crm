import { handle, ok, created } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { dealScopeWhere } from "@/lib/rbac";
import { dealCreateSchema, dealListQuerySchema } from "@/domain/deals/deal.schema";
import { createDeal, listDeals } from "@/domain/deals/deal.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const query = dealListQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
    return ok(await listDeals(query, dealScopeWhere(user)));
  });
}

export function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const input = dealCreateSchema.parse(await req.json());
    const deal = await createDeal(input, {
      actor: { kind: "user", userId: user.id, label: user.email },
    });
    return created({ deal });
  });
}
