/**
 * Dashboard metrics. Every number is a live aggregate query. Archived leads are
 * excluded. A `scope` (RBAC) can be passed to limit a Sales user to their own
 * records; Managers and above pass none.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getStatuses, getSources } from "@/domain/statuses/status.service";
import { conversionRate, openCount } from "./dashboard.math";

type LeadScope = Prisma.LeadWhereInput;
type DealScope = Prisma.DealWhereInput;

const leadWhere = (scope: LeadScope = {}): Prisma.LeadWhereInput => ({ isArchived: false, ...scope });

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function startOfWeek(): Date {
  const d = startOfToday();
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d;
}
function startOfMonth(): Date {
  const d = startOfToday();
  d.setDate(1);
  return d;
}

export async function getSummary(scope: LeadScope = {}) {
  const base = leadWhere(scope);
  const [statuses, total, today, week, month, byStatusRaw] = await Promise.all([
    getStatuses(),
    prisma.lead.count({ where: base }),
    prisma.lead.count({ where: { ...base, createdAt: { gte: startOfToday() } } }),
    prisma.lead.count({ where: { ...base, createdAt: { gte: startOfWeek() } } }),
    prisma.lead.count({ where: { ...base, createdAt: { gte: startOfMonth() } } }),
    prisma.lead.groupBy({ by: ["statusKey"], where: base, _count: { statusKey: true } }),
  ]);

  const countByStatus = new Map<string, number>();
  for (const row of byStatusRaw) countByStatus.set(row.statusKey, row._count.statusKey);

  const converted = statuses.filter((s) => s.isConverted).reduce((sum, s) => sum + (countByStatus.get(s.key) ?? 0), 0);
  const lost = statuses.filter((s) => s.isLost).reduce((sum, s) => sum + (countByStatus.get(s.key) ?? 0), 0);

  return {
    total,
    createdToday: today,
    createdThisWeek: week,
    createdThisMonth: month,
    converted,
    lost,
    open: openCount(total, converted, lost),
    conversionRate: conversionRate(converted, total),
    byStatus: statuses.map((s) => ({
      key: s.key,
      label: s.label,
      color: s.color,
      count: countByStatus.get(s.key) ?? 0,
    })),
    generatedAt: new Date().toISOString(),
  };
}

export async function getLeadsByStatus(scope: LeadScope = {}) {
  const [statuses, rows] = await Promise.all([
    getStatuses(),
    prisma.lead.groupBy({ by: ["statusKey"], where: leadWhere(scope), _count: { statusKey: true } }),
  ]);
  const map = new Map(rows.map((r) => [r.statusKey, r._count.statusKey]));
  return statuses.map((s) => ({ key: s.key, label: s.label, color: s.color, count: map.get(s.key) ?? 0 }));
}

export async function getLeadsBySource(scope: LeadScope = {}) {
  const [sources, rows] = await Promise.all([
    getSources(),
    prisma.lead.groupBy({ by: ["sourceKey"], where: leadWhere(scope), _count: { sourceKey: true } }),
  ]);
  const map = new Map(rows.map((r) => [r.sourceKey, r._count.sourceKey]));
  return sources.map((s) => ({ key: s.key, label: s.label, color: s.color, count: map.get(s.key) ?? 0 }));
}

export async function getLeadsByOwner(scope: LeadScope = {}) {
  const base = leadWhere(scope);
  const rows = await prisma.lead.groupBy({ by: ["ownerId"], where: base, _count: { ownerId: true } });
  const ids = rows.map((r) => r.ownerId).filter((v): v is string => !!v);
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
  const nameById = new Map(users.map((u) => [u.id, u.name]));
  const total = await prisma.lead.count({ where: base });
  return rows
    .map((r) => ({
      ownerId: r.ownerId,
      name: r.ownerId ? (nameById.get(r.ownerId) ?? "Unknown") : "Unassigned",
      count: r._count.ownerId,
    }))
    .sort((a, b) => b.count - a.count)
    .map((r) => ({ ...r, pct: total === 0 ? 0 : Math.round((r.count / total) * 100) }));
}

export async function getLeadsByTechnicalMember(scope: LeadScope = {}) {
  const base = leadWhere(scope);
  const rows = await prisma.lead.groupBy({
    by: ["technicalMemberId"],
    where: base,
    _count: { technicalMemberId: true },
  });
  const ids = rows.map((r) => r.technicalMemberId).filter((v): v is string => !!v);
  const members = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, color: true },
  });
  const byId = new Map(members.map((m) => [m.id, m]));
  const total = await prisma.lead.count({ where: base });
  const unassigned = await prisma.lead.count({ where: { ...base, technicalMemberId: null } });
  const assigned = rows
    .filter((r) => r.technicalMemberId)
    .map((r) => ({
      technicalMemberId: r.technicalMemberId as string,
      name: byId.get(r.technicalMemberId as string)?.name ?? "Unknown",
      color: byId.get(r.technicalMemberId as string)?.color ?? "#6b7280",
      count: r._count.technicalMemberId,
    }))
    .sort((a, b) => b.count - a.count);
  return {
    total,
    unassigned,
    members: assigned.map((r) => ({ ...r, pct: total === 0 ? 0 : Math.round((r.count / total) * 100) })),
  };
}

export async function getRecentLeads(limit = 10, scope: LeadScope = {}) {
  return prisma.lead.findMany({
    where: leadWhere(scope),
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      status: { select: { label: true, color: true } },
      source: { select: { label: true } },
      owner: { select: { name: true } },
    },
  });
}

export async function getConversion(scope: LeadScope = {}) {
  const summary = await getSummary(scope);
  const base = leadWhere(scope);
  const months: { month: string; created: number; converted: number }[] = [];
  const convertedKeys = (await getStatuses()).filter((s) => s.isConverted).map((s) => s.key);
  for (let i = 5; i >= 0; i--) {
    const from = new Date();
    from.setMonth(from.getMonth() - i, 1);
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setMonth(to.getMonth() + 1);
    const [created, converted] = await Promise.all([
      prisma.lead.count({ where: { ...base, createdAt: { gte: from, lt: to } } }),
      prisma.lead.count({
        where: { ...base, statusKey: { in: convertedKeys }, createdAt: { gte: from, lt: to } },
      }),
    ]);
    months.push({ month: from.toLocaleString("en", { month: "short", year: "2-digit" }), created, converted });
  }
  return {
    converted: summary.converted,
    lost: summary.lost,
    open: summary.open,
    total: summary.total,
    conversionRate: summary.conversionRate,
    byMonth: months,
  };
}

/** Deal pipeline: value + count per stage, plus won/open totals. */
export async function getPipeline(scope: DealScope = {}) {
  const stages = await prisma.dealStage.findMany({ orderBy: { sortOrder: "asc" } });
  const grouped = await prisma.deal.groupBy({
    by: ["stageKey"],
    where: scope,
    _count: { stageKey: true },
    _sum: { amount: true },
  });
  const byKey = new Map(grouped.map((g) => [g.stageKey, g]));

  const perStage = stages.map((s) => ({
    key: s.key,
    label: s.label,
    isWon: s.isWon,
    isLost: s.isLost,
    count: byKey.get(s.key)?._count.stageKey ?? 0,
    amount: Number(byKey.get(s.key)?._sum.amount ?? 0),
  }));

  const wonKeys = new Set(stages.filter((s) => s.isWon).map((s) => s.key));
  const lostKeys = new Set(stages.filter((s) => s.isLost).map((s) => s.key));

  const openValue = perStage
    .filter((s) => !wonKeys.has(s.key) && !lostKeys.has(s.key))
    .reduce((sum, s) => sum + s.amount, 0);
  const wonValue = perStage.filter((s) => wonKeys.has(s.key)).reduce((sum, s) => sum + s.amount, 0);
  const openDeals = perStage
    .filter((s) => !wonKeys.has(s.key) && !lostKeys.has(s.key))
    .reduce((sum, s) => sum + s.count, 0);
  const wonCount = perStage.filter((s) => wonKeys.has(s.key)).reduce((sum, s) => sum + s.count, 0);
  const lostCount = perStage.filter((s) => lostKeys.has(s.key)).reduce((sum, s) => sum + s.count, 0);

  const totalDeals = perStage.reduce((sum, s) => sum + s.count, 0);
  const winRate = wonCount + lostCount === 0 ? 0 : Math.round((wonCount / (wonCount + lostCount)) * 1000) / 10;

  return { perStage, openValue, wonValue, openCount: openDeals, wonCount, lostCount, totalDeals, winRate };
}

export async function getEverything(leadScope: LeadScope = {}, dealScope: DealScope = {}) {
  const [summary, bySource, byOwner, byTechnicalMember, recent, conversion, pipeline] = await Promise.all([
    getSummary(leadScope),
    getLeadsBySource(leadScope),
    getLeadsByOwner(leadScope),
    getLeadsByTechnicalMember(leadScope),
    getRecentLeads(8, leadScope),
    getConversion(leadScope),
    getPipeline(dealScope),
  ]);
  return { summary, bySource, byOwner, byTechnicalMember, recent, conversion, pipeline };
}
