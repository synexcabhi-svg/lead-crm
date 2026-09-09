/**
 * CORS handling for the PUBLIC lead endpoint, which is called cross-origin
 * from marketing sites. Admin APIs are same-origin and get no CORS headers.
 */
import { env } from "@/config/env";

function allowedOrigin(req: Request): string | null {
  const origin = req.headers.get("origin");
  if (env.corsOrigin === "*") return "*";
  if (!origin) return null;
  const allowList = env.corsOrigin.split(",").map((s) => s.trim());
  return allowList.includes(origin) ? origin : null;
}

export function corsHeaders(req: Request): Record<string, string> {
  const origin = allowedOrigin(req);
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

export function withCors(req: Request, res: Response): Response {
  const headers = corsHeaders(req);
  for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
  return res;
}

export function preflight(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}
