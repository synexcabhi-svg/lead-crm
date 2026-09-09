import { z } from "zod";
import { handle, ok, created, forbidden } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listTerritories, createTerritory } from "@/domain/team/territory.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z
  .object({
    technicalMemberId: z.string().trim().min(1),
    country: z.string().trim().max(80).optional(),
    state: z.string().trim().max(80).optional(),
    city: z.string().trim().max(80).optional(),
    sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
  })
  .refine((v) => v.country || v.state || v.city, {
    message: "Provide at least a city, state or country",
  });

export function GET() {
  return handle(async () => {
    await requireUser();
    return ok(await listTerritories());
  });
}

export function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    if (!can.manageTerritories(user)) throw forbidden("Only a Manager or above can manage territories");
    const input = createSchema.parse(await req.json());
    return created({ territory: await createTerritory(input) });
  });
}
