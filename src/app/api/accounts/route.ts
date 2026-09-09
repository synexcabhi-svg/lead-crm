import { z } from "zod";
import { handle, ok, created } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { listAccounts, createAccount } from "@/domain/accounts/account.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().trim().min(1).max(140),
  industry: z.string().trim().max(80).optional(),
  website: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(2000).optional(),
  ownerId: z.string().trim().optional(),
});

export function GET(req: Request) {
  return handle(async () => {
    await requireUser();
    const sp = new URL(req.url).searchParams;
    return ok(
      await listAccounts({
        q: sp.get("q") ?? undefined,
        page: Number(sp.get("page") ?? 1),
        pageSize: Number(sp.get("pageSize") ?? 25),
      }),
    );
  });
}

export function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const input = createSchema.parse(await req.json());
    const account = await createAccount(input, {
      actor: { kind: "user", userId: user.id, label: user.email },
    });
    return created({ account });
  });
}
