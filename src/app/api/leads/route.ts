/**
 * GET  /api/leads   - paginated / filtered / sorted list  (any signed-in user)
 * POST /api/leads   - create a lead as an admin user       (any signed-in user)
 *
 * POST calls the SAME LeadService.createLead as the public endpoint.
 */
import { handle, ok, created, forbidden } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { can, leadScopeWhere } from "@/lib/rbac";
import { leadAdminSchema, leadListQuerySchema } from "@/domain/leads/lead.schema";
import { createLead, listLeads } from "@/domain/leads/lead.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const url = new URL(req.url);
    const query = leadListQuerySchema.parse(Object.fromEntries(url.searchParams));
    const result = await listLeads(query, leadScopeWhere(user));
    return ok(result);
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const input = leadAdminSchema.parse(await req.json());

    // A Sales user can only create leads owned by / assigned to themselves.
    if (!can.reassignOwner(user)) {
      if (input.ownerId && input.ownerId !== user.id) {
        throw forbidden("You can only create leads owned by yourself");
      }
      if (input.technicalMemberId && input.technicalMemberId !== user.id) {
        throw forbidden("You can only assign leads to yourself");
      }
    }

    const { lead, deduped } = await createLead(input, {
      origin: "admin",
      actor: { kind: "user", userId: user.id, label: user.email },
    });
    return created({ lead, deduped });
  });
}
