import { z } from "zod";
import { handle, ok } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { addDealContact } from "@/domain/deals/deal.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  contactId: z.string().trim().min(1),
  role: z.string().trim().max(40).optional(),
});

export function POST(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requireUser();
    const { contactId, role } = bodySchema.parse(await req.json());
    const deal = await addDealContact(params.id, contactId, role, {
      actor: { kind: "user", userId: user.id, label: user.email },
    });
    return ok({ deal });
  });
}
