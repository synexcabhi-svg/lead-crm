/**
 * GET /api/health - liveness probe. No auth. Runs one trivial query so a
 * scheduled ping keeps BOTH the serverless function and the (auto-suspending)
 * database warm. Returns 200 when the DB answers, 503 otherwise.
 */
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json(
      { ok: true, at: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { ok: false, at: new Date().toISOString() },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
