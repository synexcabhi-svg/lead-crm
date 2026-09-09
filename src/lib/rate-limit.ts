/**
 * Minimal in-memory sliding-window rate limiter for the public endpoint.
 * Per-process only - fine for a single-instance modular monolith. Swap for
 * Redis if you run multiple instances.
 */
const hits = new Map<string, number[]>();

export interface RateResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();
  const cutoff = now - windowMs;
  const timestamps = (hits.get(key) ?? []).filter((t) => t > cutoff);

  if (timestamps.length >= limit) {
    const retryAfterMs = timestamps[0] + windowMs - now;
    hits.set(key, timestamps);
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  timestamps.push(now);
  hits.set(key, timestamps);
  return { allowed: true, remaining: limit - timestamps.length, retryAfterMs: 0 };
}

export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

// periodic cleanup so the map cannot grow unbounded
if (typeof setInterval !== "undefined") {
  setInterval(
    () => {
      const now = Date.now();
      for (const [k, v] of hits) {
        const fresh = v.filter((t) => t > now - 60 * 60 * 1000);
        if (fresh.length === 0) hits.delete(k);
        else hits.set(k, fresh);
      }
    },
    10 * 60 * 1000,
  ).unref?.();
}
