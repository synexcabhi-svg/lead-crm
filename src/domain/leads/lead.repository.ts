/**
 * Data-access layer for leads. The ONLY module that builds Prisma queries for
 * the Lead table. LeadService depends on this; routes/UI never touch Prisma
 * for leads directly.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { LeadListQuery } from "./lead.schema";

export const leadDetailInclude = {
  status: true,
  source: true,
  owner: { select: { id: true, name: true, email: true } },
  technicalMember: { select: { id: true, name: true, color: true } },
  duplicateOf: { select: { id: true, firstName: true, lastName: true, email: true } },
  convertedAccount: { select: { id: true, name: true } },
  convertedContact: { select: { id: true, firstName: true, lastName: true } },
  convertedDeal: { select: { id: true, name: true, amount: true, currency: true } },
} satisfies Prisma.LeadInclude;

export type LeadWithRelations = Prisma.LeadGetPayload<{ include: typeof leadDetailInclude }>;

export function findById(id: string) {
  return prisma.lead.findUnique({ where: { id }, include: leadDetailInclude });
}

export function createLead(data: Prisma.LeadUncheckedCreateInput) {
  return prisma.lead.create({ data, include: leadDetailInclude });
}

export function updateLead(id: string, data: Prisma.LeadUncheckedUpdateInput) {
  return prisma.lead.update({ where: { id }, data, include: leadDetailInclude });
}

/** Duplicate lookup: newest non-archived lead matching email or phone. */
export function findDuplicate(match: { email?: string | null; phone?: string | null }) {
  const or: Prisma.LeadWhereInput[] = [];
  if (match.email) or.push({ email: { equals: match.email, mode: "insensitive" } });
  if (match.phone) or.push({ phone: match.phone });
  if (or.length === 0) return Promise.resolve(null);
  return prisma.lead.findFirst({
    where: { isArchived: false, OR: or },
    orderBy: { createdAt: "desc" },
    include: leadDetailInclude,
  });
}

function buildWhere(q: LeadListQuery): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = {};

  if (q.archived === "false") where.isArchived = false;
  else if (q.archived === "true") where.isArchived = true;

  if (q.status) where.statusKey = q.status;
  if (q.source) where.sourceKey = q.source;
  if (q.priority) where.priority = q.priority;
  if (q.owner) where.ownerId = q.owner === "unassigned" ? null : q.owner;
  if (q.tech) where.technicalMemberId = q.tech === "unassigned" ? null : q.tech;
  if (q.state) where.state = { equals: q.state, mode: "insensitive" };

  if (q.q) {
    where.OR = [
      { firstName: { contains: q.q, mode: "insensitive" } },
      { lastName: { contains: q.q, mode: "insensitive" } },
      { email: { contains: q.q, mode: "insensitive" } },
      { phone: { contains: q.q } },
      { company: { contains: q.q, mode: "insensitive" } },
      { city: { contains: q.q, mode: "insensitive" } },
      { state: { contains: q.q, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function listLeads(q: LeadListQuery, scope?: Prisma.LeadWhereInput) {
  const built = buildWhere(q);
  const where: Prisma.LeadWhereInput = scope ? { AND: [built, scope] } : built;
  const [items, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: leadDetailInclude,
      orderBy: { [q.sortBy]: q.sortDir },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    prisma.lead.count({ where }),
  ]);
  return {
    items,
    total,
    page: q.page,
    pageSize: q.pageSize,
    totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
  };
}
