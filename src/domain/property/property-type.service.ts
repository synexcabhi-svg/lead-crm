/**
 * Centralized access to the configurable Property Type picklist. This is a real
 * table (seeded, no admin UI yet) so it can later grow into a property / product
 * master that quotations and sales orders reference.
 */
import { prisma } from "@/lib/prisma";
import { badRequest } from "@/lib/http";

const CACHE_MS = 15_000;
let cache: { value: Awaited<ReturnType<typeof load>>; at: number } | null = null;

function load() {
  return prisma.propertyType.findMany({ orderBy: [{ sortOrder: "asc" }, { label: "asc" }] });
}

export async function getPropertyTypes() {
  if (!cache || Date.now() - cache.at > CACHE_MS) {
    cache = { value: await load(), at: Date.now() };
  }
  return cache.value;
}

export function invalidatePropertyTypeCache() {
  cache = null;
}

export async function assertPropertyTypeKey(key: string): Promise<void> {
  const types = await getPropertyTypes();
  if (!types.some((t) => t.key === key && t.isActive)) {
    throw badRequest(`Unknown property type: "${key}"`, { field: "propertyTypeKey" });
  }
}
