/**
 * Territory rules - which technical member covers which city/state/country.
 * Used to auto-assign incoming leads by location.
 */
import { prisma } from "@/lib/prisma";
import { badRequest } from "@/lib/http";
import { matchTerritory, type LeadLocation } from "./territory.match";

const CACHE_MS = 15_000;
let cache: { value: Awaited<ReturnType<typeof loadActive>>; at: number } | null = null;

function loadActive() {
  return prisma.territory.findMany({
    where: { isActive: true, technicalMember: { isActive: true } },
    orderBy: { sortOrder: "asc" },
  });
}

export async function getActiveTerritories() {
  if (!cache || Date.now() - cache.at > CACHE_MS) {
    cache = { value: await loadActive(), at: Date.now() };
  }
  return cache.value;
}
export function invalidateTerritoryCache() {
  cache = null;
}

/** null if no rule covers this location (or location is empty). */
export async function resolveTechnicalMemberForLocation(loc: LeadLocation): Promise<string | null> {
  const rules = await getActiveTerritories();
  return matchTerritory(loc, rules);
}

export function listTerritories() {
  return prisma.territory.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { technicalMember: { select: { id: true, name: true, isActive: true } } },
  });
}

export async function createTerritory(input: {
  technicalMemberId: string;
  country?: string;
  state?: string;
  city?: string;
  sortOrder?: number;
}) {
  const clean = (v?: string) => {
    const t = (v ?? "").trim();
    return t === "" ? null : t;
  };
  const country = clean(input.country);
  const state = clean(input.state);
  const city = clean(input.city);
  if (!country && !state && !city) {
    throw badRequest("A territory needs at least a city, state or country");
  }
  const member = await prisma.user.findUnique({ where: { id: input.technicalMemberId } });
  if (!member) throw badRequest("Unknown person", { field: "technicalMemberId" });

  invalidateTerritoryCache();
  return prisma.territory.create({
    data: {
      technicalMemberId: input.technicalMemberId,
      country,
      state,
      city,
      sortOrder: input.sortOrder ?? 0,
    },
    include: { technicalMember: { select: { id: true, name: true } } },
  });
}

export async function deleteTerritory(id: string) {
  invalidateTerritoryCache();
  await prisma.territory.delete({ where: { id } });
}
