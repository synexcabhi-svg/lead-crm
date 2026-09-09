import { handle, ok } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { leadScopeWhere } from "@/lib/rbac";
import { getSummary } from "@/domain/dashboard/dashboard.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return handle(async () => {
    const user = await requireUser();
    return ok(await getSummary(leadScopeWhere(user)));
  });
}
