import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DealListQuery } from "./deal.schema";

export const dealDetailInclude = {
  stage: true,
  account: { select: { id: true, name: true } },
  primaryContact: { select: { id: true, firstName: true, lastName: true, email: true } },
  owner: { select: { id: true, name: true } },
  technicalMember: { select: { id: true, name: true, color: true } },
  sourceLead: { select: { id: true, firstName: true, lastName: true } },
  associatedContacts: {
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    include: {
      contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
    },
  },
} satisfies Prisma.DealInclude;

export type DealWithRelations = Prisma.DealGetPayload<{ include: typeof dealDetailInclude }>;

export function findById(id: string) {
  return prisma.deal.findUnique({ where: { id }, include: dealDetailInclude });
}

export function createDeal(data: Prisma.DealUncheckedCreateInput) {
  return prisma.deal.create({ data, include: dealDetailInclude });
}

export function updateDeal(id: string, data: Prisma.DealUncheckedUpdateInput) {
  return prisma.deal.update({ where: { id }, data, include: dealDetailInclude });
}

function buildWhere(q: DealListQuery, openStageKeys: string[]): Prisma.DealWhereInput {
  const where: Prisma.DealWhereInput = {};
  if (q.stage) where.stageKey = q.stage;
  if (q.account) where.accountId = q.account;
  if (q.owner) where.ownerId = q.owner === "unassigned" ? null : q.owner;
  if (q.tech) where.technicalMemberId = q.tech === "unassigned" ? null : q.tech;
  if (q.open === "true") where.stageKey = { in: openStageKeys };
  if (q.open === "false") where.stageKey = { notIn: openStageKeys };
  if (q.q) {
    where.OR = [
      { name: { contains: q.q, mode: "insensitive" } },
      { account: { name: { contains: q.q, mode: "insensitive" } } },
    ];
  }
  return where;
}

export async function listDeals(q: DealListQuery, openStageKeys: string[], scope?: Prisma.DealWhereInput) {
  const built = buildWhere(q, openStageKeys);
  const where: Prisma.DealWhereInput = scope ? { AND: [built, scope] } : built;
  const [items, total, sum] = await Promise.all([
    prisma.deal.findMany({
      where,
      include: dealDetailInclude,
      orderBy: { [q.sortBy]: q.sortDir },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    prisma.deal.count({ where }),
    prisma.deal.aggregate({ where, _sum: { amount: true } }),
  ]);
  return {
    items,
    total,
    totalAmount: sum._sum.amount ?? 0,
    page: q.page,
    pageSize: q.pageSize,
    totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
  };
}
