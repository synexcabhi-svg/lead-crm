/**
 * GET /api/public/geo - approximate location for the visitor currently loading
 * the public lead form, derived from their IP. Public (no auth), CORS-enabled,
 * lightly rate-limited. Returns { geo: { city, state, country, postalCode } | null }.
 *
 * In development you can force an IP with ?ip=8.8.8.8 (ignored in production).
 */
import { handle, ok } from "@/lib/http";
import { env } from "@/config/env";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { preflight, withCors } from "@/lib/cors";
import { lookupGeo } from "@/lib/geoip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(req: Request) {
  return preflight(req);
}

export async function GET(req: Request) {
  const res = await handle(async () => {
    const ip = clientIp(req);
    const rl = rateLimit(`public-geo:${ip}`, 30, 5 * 60 * 1000);
    if (!rl.allowed) return ok({ geo: null });

    const forced = !env.isProd ? new URL(req.url).searchParams.get("ip") : null;
    const geo = await lookupGeo(forced || ip);
    return ok({ geo });
  });
  return withCors(req, res);
}
