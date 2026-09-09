import { handle, ok } from "@/lib/http";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    return ok(user);
  });
}
