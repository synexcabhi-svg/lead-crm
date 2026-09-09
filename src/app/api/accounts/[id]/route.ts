import { z } from "zod";
import { handle, ok, notFound } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { getAccount, updateAccount } from "@/domain/accounts/account.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Ctx {
  params: { id: string };
}

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(140).optional(),
    industry: z.string().trim().max(80).optional(),
    website: z.string().trim().max(200).optional(),
    phone: z.string().trim().max(40).optional(),
    notes: z.string().trim().max(2000).optional(),
    ownerId: z.string().trim().optional(),
    city: z.string().trim().max(80).optional(),
    state: z.string().trim().max(80).optional(),
    country: z.string().trim().max(80).optional(),
    postalCode: z.string().trim().max(20).optional(),
    technicalMemberId: z.string().trim().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update" });

export async function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    await requireUser();
    const account = await getAccount(params.id);
    if (!account) throw notFound(`Account ${params.id} not found`);
    return ok({ account });
  });
}

export function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireUser();
    const input = patchSchema.parse(await req.json());
    const account = await updateAccount(params.id, input, {
      actor: { kind: "user", userId: user.id, label: user.email },
    });
    return ok({ account });
  });
}
