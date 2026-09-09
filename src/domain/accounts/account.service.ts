/**
 * Accounts (companies) and their Contacts (people). Used directly by the
 * Accounts module and by lead conversion.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { emitLeadEvent } from "@/lib/events";
import { recordAudit, actorLabel, type Actor } from "@/domain/audit/audit.service";
import { badRequest, notFound } from "@/lib/http";
import { ACCOUNT_CREATED_ACTION } from "@/domain/deals/deal.constants";

export const accountDetailInclude = {
  owner: { select: { id: true, name: true } },
  technicalMember: { select: { id: true, name: true, color: true } },
  contacts: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      title: true,
      city: true,
      state: true,
      country: true,
      postalCode: true,
      technicalMember: { select: { id: true, name: true, color: true } },
    },
  },
  deals: {
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      amount: true,
      currency: true,
      stage: { select: { label: true, isWon: true, isLost: true } },
    },
  },
} satisfies Prisma.AccountInclude;

const clean = (v?: string | null) => {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
};

/** location + technical-member fields shared by account & contact creation */
export interface LocationInput {
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  technicalMemberId?: string | null;
}
const locationData = (i: LocationInput) => ({
  city: clean(i.city),
  state: clean(i.state),
  country: clean(i.country),
  postalCode: clean(i.postalCode),
  technicalMemberId: clean(i.technicalMemberId),
});

export function getAccount(id: string) {
  return prisma.account.findUnique({ where: { id }, include: accountDetailInclude });
}

export async function listAccounts(opts: { q?: string; page?: number; pageSize?: number } = {}) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 25));
  const where: Prisma.AccountWhereInput = opts.q
    ? {
        OR: [
          { name: { contains: opts.q, mode: "insensitive" } },
          { city: { contains: opts.q, mode: "insensitive" } },
          { state: { contains: opts.q, mode: "insensitive" } },
        ],
      }
    : {};
  const [items, total] = await Promise.all([
    prisma.account.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        owner: { select: { name: true } },
        technicalMember: { select: { name: true, color: true } },
        _count: { select: { contacts: true, deals: true } },
      },
    }),
    prisma.account.count({ where }),
  ]);
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function createAccount(
  input: {
    name: string;
    industry?: string;
    website?: string;
    phone?: string;
    notes?: string;
    ownerId?: string;
  } & LocationInput,
  ctx: { actor: Actor },
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const name = input.name.trim();
  if (!name) throw badRequest("Account name is required", { field: "name" });
  const account = await tx.account.create({
    data: {
      name,
      industry: clean(input.industry),
      website: clean(input.website),
      phone: clean(input.phone),
      notes: clean(input.notes),
      ownerId: clean(input.ownerId),
      ...locationData(input),
    },
  });
  await recordAudit(
    ctx.actor,
    { action: ACCOUNT_CREATED_ACTION, newValue: name, metadata: { accountId: account.id } },
    tx,
  );
  emitLeadEvent({
    type: "account.created",
    accountId: account.id,
    at: new Date().toISOString(),
    actor: actorLabel(ctx.actor),
  });
  return account;
}

/**
 * Find an existing account by exact (case-insensitive) name, or create one.
 * Location / technical member are only applied when a NEW account is created -
 * an existing account's details are left untouched.
 */
export async function findOrCreateAccountByName(
  name: string,
  ctx: { actor: Actor },
  ownerId: string | null,
  extra: LocationInput = {},
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const trimmed = name.trim();
  const existing = await tx.account.findFirst({
    where: { name: { equals: trimmed, mode: "insensitive" } },
  });
  if (existing) return { account: existing, created: false };
  const account = await createAccount({ name: trimmed, ownerId: ownerId ?? undefined, ...extra }, ctx, tx);
  return { account, created: true };
}

export async function createContact(
  input: {
    firstName: string;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
    title?: string | null;
    accountId: string;
    ownerId?: string | null;
  } & LocationInput,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  return tx.contact.create({
    data: {
      firstName: input.firstName.trim(),
      lastName: clean(input.lastName),
      email: clean(input.email),
      phone: clean(input.phone),
      title: clean(input.title),
      accountId: input.accountId,
      ownerId: clean(input.ownerId),
      ...locationData(input),
    },
  });
}

export async function updateAccount(
  id: string,
  input: Partial<{
    name: string;
    industry: string;
    website: string;
    phone: string;
    notes: string;
    ownerId: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    technicalMemberId: string;
  }>,
  ctx: { actor: Actor },
) {
  const current = await prisma.account.findUnique({ where: { id } });
  if (!current) throw notFound(`Account ${id} not found`);
  const data: Record<string, string | null> = {};
  for (const k of [
    "industry",
    "website",
    "phone",
    "notes",
    "ownerId",
    "city",
    "state",
    "country",
    "postalCode",
    "technicalMemberId",
  ] as const) {
    if (input[k] !== undefined) data[k] = clean(input[k]);
  }
  if (input.name !== undefined && input.name.trim()) data.name = input.name.trim();
  const updated = await prisma.account.update({ where: { id }, data, include: accountDetailInclude });
  await recordAudit(ctx.actor, {
    action: "ACCOUNT_UPDATED",
    metadata: { accountId: id, fields: Object.keys(data) },
  });
  return updated;
}
