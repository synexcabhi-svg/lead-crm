import { cookies } from "next/headers";
import { ok } from "@/lib/http";
import { COOKIE_NAME } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  cookies().delete(COOKIE_NAME);
  return ok({ ok: true });
}
