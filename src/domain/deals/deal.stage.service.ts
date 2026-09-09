/**
 * Centralized access to the configurable deal pipeline stages - the Deal
 * analogue of status.service for leads. No module hard-codes stage keys.
 */
import { prisma } from "@/lib/prisma";
import { badRequest } from "@/lib/http";

const CACHE_MS = 15_000;
let cache: { value: Awaited<ReturnType<typeof load>>; at: number } | null = null;

function load() {
  return prisma.dealStage.findMany({ orderBy: { sortOrder: "asc" } });
}

export async function getDealStages() {
  if (!cache || Date.now() - cache.at > CACHE_MS) {
    cache = { value: await load(), at: Date.now() };
  }
  return cache.value;
}

export function invalidateDealStageCache() {
  cache = null;
}

export async function getDefaultDealStageKey(): Promise<string> {
  const stages = await getDealStages();
  const def = stages.find((s) => s.isDefault && s.isActive) ?? stages.find((s) => s.isActive);
  if (!def) throw new Error("No active DealStage configured - run `npm run db:seed`");
  return def.key;
}

export async function assertDealStageKey(key: string): Promise<void> {
  const stages = await getDealStages();
  if (!stages.some((s) => s.key === key && s.isActive)) {
    throw badRequest(`Unknown deal stage: "${key}"`, { field: "stageKey" });
  }
}

export async function getWonStageKeys(): Promise<string[]> {
  return (await getDealStages()).filter((s) => s.isWon).map((s) => s.key);
}
export async function getLostStageKeys(): Promise<string[]> {
  return (await getDealStages()).filter((s) => s.isLost).map((s) => s.key);
}
export async function isClosedStage(key: string): Promise<boolean> {
  return (await getDealStages()).some((s) => s.key === key && (s.isWon || s.isLost));
}
