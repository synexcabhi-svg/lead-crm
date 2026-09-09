/**
 * Centralized environment configuration. Read env vars ONLY through this module
 * so defaults, parsing and validation live in one place.
 */

export type DuplicateStrategy = "allow" | "flag" | "reject" | "update";

function str(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing required env var: ${name}`);
  return v;
}
function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}
function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return raw === "true" || raw === "1";
}

const validStrategies: DuplicateStrategy[] = ["allow", "flag", "reject", "update"];
const rawStrategy = (process.env.DUPLICATE_STRATEGY || "flag") as DuplicateStrategy;

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  isProd: process.env.NODE_ENV === "production",

  databaseUrl: str("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/lead_crm?schema=public"),
  jwtSecret: str("JWT_SECRET", "dev-insecure-secret-change-me-please-0000000000"),
  appUrl: str("APP_URL", "http://localhost:3000"),

  corsOrigin: str("CORS_ORIGIN", "*"),

  duplicate: {
    strategy: validStrategies.includes(rawStrategy) ? rawStrategy : "flag",
    matchFields: str("DUPLICATE_MATCH_FIELDS", "email,phone")
      .split(",")
      .map((s) => s.trim())
      .filter((s): s is "email" | "phone" => s === "email" || s === "phone"),
  },

  publicForm: {
    rateLimit: int("PUBLIC_RATE_LIMIT", 5),
    rateWindowMs: int("PUBLIC_RATE_WINDOW_MS", 10 * 60 * 1000),
    requireConsent: bool("REQUIRE_CONSENT", false),
  },

  geo: {
    // pre-fill city/state/country on the public form from the visitor's IP
    enabled: bool("GEOIP_ENABLED", true),
    // {ip} is replaced with the visitor's address. Default: ipwho.is (free, no key,
    // HTTPS). Response fields expected: city, region, country, postal.
    providerUrl: process.env.GEOIP_PROVIDER_URL || "https://ipwho.is/{ip}",
    timeoutMs: int("GEOIP_TIMEOUT_MS", 2500),
  },

  mail: {
    // "console" = log the email to the server console (dev default, no setup)
    // "smtp"    = send via the SMTP_* settings below
    // "off"     = disable notifications entirely
    transport: (process.env.MAIL_TRANSPORT || "console") as "console" | "smtp" | "off",
    from: str("MAIL_FROM", "Lead CRM <no-reply@leadcrm.local>"),
    smtp: {
      host: process.env.SMTP_HOST || "",
      port: int("SMTP_PORT", 587),
      secure: bool("SMTP_SECURE", false),
      user: process.env.SMTP_USER || "",
      pass: process.env.SMTP_PASS || "",
    },
  },
} as const;
