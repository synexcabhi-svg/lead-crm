import { z } from "zod";
import { handle, ok, forbidden } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { can, ROLES } from "@/lib/rbac";
import { updatePerson, resetPassword } from "@/domain/people/people.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    role: z.enum(ROLES).optional(),
    color: z.string().trim().max(20).optional(),
    isActive: z.boolean().optional(),
    resetPassword: z.string().min(8).max(200).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No changes" });

export function PATCH(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requireUser();
    if (!can.managePeople(user)) throw forbidden("Only a Super Admin can manage people");
    const input = patchSchema.parse(await req.json());

    if (input.resetPassword) await resetPassword(params.id, input.resetPassword);

    const person = await updatePerson(
      params.id,
      { name: input.name, role: input.role, color: input.color, isActive: input.isActive },
      user.id,
    );
    return ok({ person });
  });
}
