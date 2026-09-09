/**
 * Best-effort IP -> approximate location lookup, used only to pre-fill the
 * public lead form (the visitor can edit or clear the fields).
 *
 * - never throws; returns null on any problem
 * - short-circuits for localhost / private IPs (no useful data there)
 * - short in-memory cache so the free provider isn't hammered
 * - hard timeout so it can never hold up the form
 *
 * Default provider: ipwho.is (free, HTTPS, no API key). Configure a different
 * one with GEOIP_PROVIDER_URL - the response parser expects the ipwho.is
 * shape: { success, city, region, country, postal }.
 */
import { env } from "@/config/env";

export interface GeoLocation {
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
}

const cache = new Map<string, { value: GeoLocation | null; at: number }>();
const CACHE_MS = 10 * 60 * 1000;

export function isPrivateOrLocal(ip: string): boolean {
  if (!ip || ip === "unknown") return true;
  const v = ip.trim().toLowerCase();
  if (v === "::1" || v === "127.0.0.1" || v.startsWith("::ffff:127.")) return true;
  if (v === "localhost") return true;
  if (/^10\./.test(v)) return true;
  if (/^192\.168\./.test(v)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(v)) return true;
  if (v.startsWith("fc") || v.startsWith("fd")) return true; // unique-local IPv6
  if (v.startsWith("169.254.") || v.startsWith("fe80:")) return true; // link-local
  return false;
}

/** Pure: map a provider JSON body to GeoLocation (ipwho.is shape). Exported for tests. */
export function parseGeoResponse(body: unknown): GeoLocation | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (b.success === false) return null;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const loc: GeoLocation = {
    city: str(b.city),
    state: str(b.region) ?? str(b.region_name) ?? str(b.state),
    country: str(b.country) ?? str(b.country_name),
    postalCode: str(b.postal) ?? str(b.postal_code) ?? str(b.zip),
  };
  if (!loc.city && !loc.state && !loc.country) return null;
  return loc;
}

export async function lookupGeo(ip: string): Promise<GeoLocation | null> {
  if (!env.geo.enabled) return null;
  if (isPrivateOrLocal(ip)) return null;

  const hit = cache.get(ip);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  let value: GeoLocation | null = null;
  try {
    const url = env.geo.providerUrl.replace("{ip}", encodeURIComponent(ip));
    const res = await fetch(url, {
      signal: AbortSignal.timeout(env.geo.timeoutMs),
      headers: { accept: "application/json" },
    });
    if (res.ok) value = parseGeoResponse(await res.json());
  } catch {
    value = null;
  }

  cache.set(ip, { value, at: Date.now() });
  return value;
}
