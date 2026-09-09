import { handle, ok } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { leadScopeWhere } from "@/lib/rbac";
import { getLeadsByOwner } from "@/domain/dashboard/dashboard.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return handle(async () => {
    const user = await requireUser();
    return ok(await getLeadsByOwner(leadScopeWhere(user)));
  });
}
