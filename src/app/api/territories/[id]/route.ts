import { handle, ok, forbidden } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { deleteTerritory } from "@/domain/team/territory.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requireUser();
    if (!can.manageTerritories(user)) throw forbidden("Only a Manager or above can manage territories");
    await deleteTerritory(params.id);
    return ok({ deleted: true, id: params.id });
  });
}
