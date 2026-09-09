/**
 * Centralized access to the configurable status + source lists. No other
 * module should hard-code status/source keys or query these tables directly.
 */
import { prisma } from "@/lib/prisma";
import { InvalidReferenceError } from "@/domain/leads/lead.errors";

const CACHE_MS = 15_000;

interface Cache<T> {
  value: T;
  at: number;
}
let statusCache: Cache<Awaited<ReturnType<typeof loadStatuses>>> | null = null;
let sourceCache: Cache<Awaited<ReturnType<typeof loadSources>>> | null = null;

function loadStatuses() {
  return prisma.leadStatus.findMany({ orderBy: { sortOrder: "asc" } });
}
function loadSources() {
  return prisma.leadSource.findMany({ orderBy: { label: "asc" } });
}

export async function getStatuses() {
  if (!statusCache || Date.now() - statusCache.at > CACHE_MS) {
    statusCache = { value: await loadStatuses(), at: Date.now() };
  }
  return statusCache.value;
}

export async function getSources() {
  if (!sourceCache || Date.now() - sourceCache.at > CACHE_MS) {
    sourceCache = { value: await loadSources(), at: Date.now() };
  }
  return sourceCache.value;
}

export function invalidateStatusCache() {
  statusCache = null;
  sourceCache = null;
}

export async function getDefaultStatusKey(): Promise<string> {
  const statuses = await getStatuses();
  const def = statuses.find((s) => s.isDefault && s.isActive) ?? statuses.find((s) => s.isActive);
  if (!def) throw new Error("No active LeadStatus configured - run `npm run db:seed`");
  return def.key;
}

export async function assertStatusKey(key: string): Promise<void> {
  const statuses = await getStatuses();
  if (!statuses.some((s) => s.key === key && s.isActive)) {
    throw new InvalidReferenceError("statusKey", key);
  }
}

export async function assertSourceKey(key: string): Promise<void> {
  const sources = await getSources();
  if (!sources.some((s) => s.key === key && s.isActive)) {
    throw new InvalidReferenceError("sourceKey", key);
  }
}

/** Set of status keys that count as "converted" for conversion-rate math. */
export async function getConvertedStatusKeys(): Promise<string[]> {
  return (await getStatuses()).filter((s) => s.isConverted).map((s) => s.key);
}
export async function getLostStatusKeys(): Promise<string[]> {
  return (await getStatuses()).filter((s) => s.isLost).map((s) => s.key);
}
