/**
 * POST /api/public/leads - the ONLY endpoint the public website form calls.
 *
 * No auth. Rate-limited per IP. Honeypot spam check. Field set restricted by
 * leadPublicSchema. Internally it calls the SAME LeadService.createLead as
 * the admin endpoint - one code path, one database table.
 */
import { handle, created, tooManyRequests, badRequest } from "@/lib/http";
import { env } from "@/config/env";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { preflight, withCors } from "@/lib/cors";
import { leadPublicSchema } from "@/domain/leads/lead.schema";
import { createLead } from "@/domain/leads/lead.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(req: Request) {
  return preflight(req);
}

export async function POST(req: Request) {
  const res = await handle(async () => {
    const ip = clientIp(req);
    const rl = rateLimit(`public-lead:${ip}`, env.publicForm.rateLimit, env.publicForm.rateWindowMs);
    if (!rl.allowed) {
      throw tooManyRequests(
        `Too many submissions. Try again in ${Math.ceil(rl.retryAfterMs / 1000)}s.`,
      );
    }

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      throw badRequest("Invalid JSON body");
    }

    const input = leadPublicSchema.parse(json);

    // Honeypot: silently accept but drop obvious bots.
    if (input.website && input.website.length > 0) {
      return created({ ok: true });
    }

    if (env.publicForm.requireConsent && !input.consent) {
      throw badRequest("Consent is required", { field: "consent" });
    }

    const { lead } = await createLead(
      {
        firstName: input.firstName,
        lastName: input.lastName || undefined,
        email: input.email || undefined,
        phone: input.phone || undefined,
        company: input.company || undefined,
        message: input.message || undefined,
        city: input.city || undefined,
        state: input.state || undefined,
        country: input.country || undefined,
        postalCode: input.postalCode || undefined,
        consent: Boolean(input.consent),
        ipAddress: ip,
        userAgent: req.headers.get("user-agent") ?? undefined,
      },
      { origin: "public", actor: { kind: "public" } },
    );

    // Do not leak internal fields to an anonymous caller.
    return created({ ok: true, id: lead.id });
  });

  return withCors(req, res);
}
