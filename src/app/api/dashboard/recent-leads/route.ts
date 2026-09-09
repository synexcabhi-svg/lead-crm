import { handle, ok } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { leadScopeWhere } from "@/lib/rbac";
import { getRecentLeads } from "@/domain/dashboard/dashboard.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const limit = Number(new URL(req.url).searchParams.get("limit") ?? 10);
    return ok(
      await getRecentLeads(
        Number.isFinite(limit) ? Math.min(50, Math.max(1, limit)) : 10,
        leadScopeWhere(user),
      ),
    );
  });
}
