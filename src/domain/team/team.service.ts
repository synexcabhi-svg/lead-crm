/**
 * The assignable people list (Sales Team + everyone else). Backed by the User
 * table now - the same list also feeds the "Owner" picker. Kept under this
 * module name so existing callers don't churn.
 */
import { prisma } from "@/lib/prisma";
import { badRequest } from "@/lib/http";

const CACHE_MS = 15_000;
let cache: { value: Awaited<ReturnType<typeof load>>; at: number } | null = null;

function load() {
  return prisma.user.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, email: true, color: true, role: true, isActive: true },
  });
}

export async function getTechnicalMembers() {
  if (!cache || Date.now() - cache.at > CACHE_MS) {
    cache = { value: await load(), at: Date.now() };
  }
  return cache.value;
}

export function invalidateTeamCache() {
  cache = null;
}

export async function assertTechnicalMember(id: string): Promise<void> {
  const members = await getTechnicalMembers();
  if (!members.some((m) => m.id === id && m.isActive)) {
    throw badRequest(`Unknown or inactive person: ${id}`, { field: "technicalMemberId" });
  }
}
