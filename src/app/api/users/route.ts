import { z } from "zod";
import { handle, ok, created } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { can, ROLES } from "@/lib/rbac";
import { forbidden } from "@/lib/http";
import { listPeople, createPerson } from "@/domain/people/people.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(ROLES),
  color: z.string().trim().max(20).optional(),
  tempPassword: z.string().min(8).max(200),
});

export function GET() {
  return handle(async () => {
    const user = await requireUser();
    if (!can.managePeople(user)) throw forbidden("Only a Super Admin can manage people");
    return ok(await listPeople());
  });
}

export function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    if (!can.managePeople(user)) throw forbidden("Only a Super Admin can manage people");
    const input = createSchema.parse(await req.json());
    return created({ person: await createPerson(input) });
  });
}
