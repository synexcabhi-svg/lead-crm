/**
 * DealService - create / update / list / read opportunities. Deals are created
 * here directly, or by lead conversion (see lead.convert.ts).
 */
import { prisma } from "@/lib/prisma";
import { emitLeadEvent, type LeadEventType } from "@/lib/events";
import { badRequest, notFound } from "@/lib/http";
import { recordAudit, actorLabel, type Actor, type AuditEntry } from "@/domain/audit/audit.service";
import {
  assertDealStageKey,
  getDefaultDealStageKey,
  getDealStages,
  isClosedStage,
  getWonStageKeys,
  getLostStageKeys,
} from "./deal.stage.service";
import { DEAL_AUDIT_ACTIONS, DEFAULT_CURRENCY } from "./deal.constants";
import * as repo from "./deal.repository";
import type { DealCreateInput, DealListQuery, DealUpdateInput } from "./deal.schema";

const clean = (v?: string | null) => {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
};
const parseDate = (v?: string | null) => {
  const s = clean(v);
  return s ? new Date(s + "T00:00:00") : null;
};

async function assertAccount(id: string) {
  if (!(await prisma.account.findUnique({ where: { id } }))) {
    throw badRequest(`Unknown account: ${id}`, { field: "accountId" });
  }
}
async function assertOwner(id: string) {
  if (!(await prisma.user.findFirst({ where: { id, isActive: true } }))) {
    throw badRequest(`Unknown or inactive owner: ${id}`, { field: "ownerId" });
  }
}
async function assertTech(id: string) {
  if (!(await prisma.user.findFirst({ where: { id, isActive: true } }))) {
    throw badRequest(`Unknown person: ${id}`, { field: "technicalMemberId" });
  }
}

export async function createDeal(input: DealCreateInput, ctx: { actor: Actor }) {
  await assertAccount(input.accountId);
  const stageKey = clean(input.stageKey) ?? (await getDefaultDealStageKey());
  await assertDealStageKey(stageKey);
  // Owner defaults to the person creating the deal.
  const ownerId = clean(input.ownerId) ?? (ctx.actor.kind === "user" ? ctx.actor.userId : null);
  if (ownerId) await assertOwner(ownerId);
  const technicalMemberId = clean(input.technicalMemberId);
  if (technicalMemberId) await assertTech(technicalMemberId);
  const primaryContactId = clean(input.primaryContactId);
  if (primaryContactId) {
    const c = await prisma.contact.findUnique({ where: { id: primaryContactId } });
    if (!c || c.accountId !== input.accountId) {
      throw badRequest("Primary contact must belong to the selected account", { field: "primaryContactId" });
    }
  }

  const deal = await repo.createDeal({
    name: input.name.trim(),
    amount: input.amount ?? null,
    currency: clean(input.currency) ?? DEFAULT_CURRENCY,
    stageKey,
    accountId: input.accountId,
    primaryContactId,
    ownerId,
    technicalMemberId,
    expectedCloseDate: parseDate(input.expectedCloseDate),
    notes: clean(input.notes),
    city: clean(input.city),
    state: clean(input.state),
    country: clean(input.country),
    postalCode: clean(input.postalCode),
    closedAt: (await isClosedStage(stageKey)) ? new Date() : null,
  });

  if (primaryContactId) {
    await prisma.dealContact.create({
      data: { dealId: deal.id, contactId: primaryContactId, role: "Primary", isPrimary: true },
    });
  }

  await recordAudit(ctx.actor, {
    dealId: deal.id,
    action: DEAL_AUDIT_ACTIONS.CREATED,
    newValue: deal.name,
    metadata: { accountId: deal.accountId, amount: deal.amount, stage: stageKey },
  });
  emitLeadEvent({
    type: "deal.created",
    dealId: deal.id,
    accountId: deal.accountId,
    at: new Date().toISOString(),
    actor: actorLabel(ctx.actor),
  });
  return deal;
}

export async function updateDeal(id: string, input: DealUpdateInput, ctx: { actor: Actor }) {
  const current = await repo.findById(id);
  if (!current) throw notFound(`Deal ${id} not found`);

  if (input.stageKey && input.stageKey !== current.stageKey) await assertDealStageKey(input.stageKey);
  if (input.accountId && input.accountId !== current.accountId) await assertAccount(input.accountId);
  if (input.ownerId) await assertOwner(input.ownerId);
  if (input.technicalMemberId) await assertTech(input.technicalMemberId);

  const data: Record<string, unknown> = {};
  const audits: AuditEntry[] = [];
  const changed: string[] = [];

  const set = (field: string, value: unknown, old: unknown) => {
    data[field] = value;
    changed.push(field);
    let action: string = DEAL_AUDIT_ACTIONS.UPDATED;
    if (field === "stageKey") action = DEAL_AUDIT_ACTIONS.STAGE_CHANGED;
    if (field === "ownerId" || field === "technicalMemberId") action = DEAL_AUDIT_ACTIONS.ASSIGNED;
    audits.push({
      dealId: id,
      action,
      field,
      oldValue: old == null ? null : String(old),
      newValue: value == null ? null : String(value),
    });
  };

  if (input.name !== undefined && input.name.trim() !== current.name) set("name", input.name.trim(), current.name);
  if (input.amount !== undefined && (input.amount ?? null) !== current.amount)
    set("amount", input.amount ?? null, current.amount);
  if (input.currency !== undefined && clean(input.currency) !== current.currency)
    set("currency", clean(input.currency) ?? DEFAULT_CURRENCY, current.currency);
  if (input.notes !== undefined && clean(input.notes) !== current.notes)
    set("notes", clean(input.notes), current.notes);
  if (input.accountId !== undefined && input.accountId !== current.accountId)
    set("accountId", input.accountId, current.accountId);

  for (const f of ["city", "state", "country", "postalCode"] as const) {
    if (input[f] === undefined) continue;
    const next = clean(input[f]);
    if (current[f] !== next) set(f, next, current[f]);
  }

  for (const f of ["ownerId", "technicalMemberId", "primaryContactId"] as const) {
    if (input[f] === undefined) continue;
    const next = input[f] === "" ? null : input[f];
    if (current[f] !== next) set(f, next, current[f]);
  }

  if (input.expectedCloseDate !== undefined) {
    const next = parseDate(input.expectedCloseDate);
    const cur = current.expectedCloseDate ? current.expectedCloseDate.toISOString().slice(0, 10) : null;
    const nextStr = next ? next.toISOString().slice(0, 10) : null;
    if (cur !== nextStr) set("expectedCloseDate", next, current.expectedCloseDate);
  }

  if (input.stageKey !== undefined && input.stageKey !== current.stageKey) {
    set("stageKey", input.stageKey, current.stageKey);
    const nowClosed = await isClosedStage(input.stageKey);
    const wasClosed = await isClosedStage(current.stageKey);
    if (nowClosed && !wasClosed) data.closedAt = new Date();
    if (!nowClosed && wasClosed) data.closedAt = null;
  }

  if (changed.length === 0) return current;

  const updated = await repo.updateDeal(id, data);
  await recordAudit(ctx.actor, audits);

  const type: LeadEventType = changed.includes("stageKey") ? "deal.stage_changed" : "deal.updated";
  emitLeadEvent({
    type,
    dealId: id,
    accountId: updated.accountId,
    at: new Date().toISOString(),
    actor: actorLabel(ctx.actor),
    changed,
  });
  return updated;
}

export async function deleteDeal(id: string, ctx: { actor: Actor }) {
  const current = await repo.findById(id);
  if (!current) throw notFound(`Deal ${id} not found`);
  await recordAudit(ctx.actor, { dealId: id, action: DEAL_AUDIT_ACTIONS.DELETED, oldValue: current.name });
  await prisma.deal.delete({ where: { id } });
  emitLeadEvent({
    type: "deal.deleted",
    dealId: id,
    at: new Date().toISOString(),
    actor: actorLabel(ctx.actor),
  });
}

export async function addDealContact(dealId: string, contactId: string, role: string | undefined, ctx: { actor: Actor }) {
  const deal = await prisma.deal.findUnique({ where: { id: dealId } });
  if (!deal) throw notFound(`Deal ${dealId} not found`);
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) throw badRequest("Unknown contact", { field: "contactId" });
  if (contact.accountId !== deal.accountId) {
    throw badRequest("Contact must belong to the deal's account", { field: "contactId" });
  }
  await prisma.dealContact.upsert({
    where: { dealId_contactId: { dealId, contactId } },
    create: { dealId, contactId, role: role?.trim() || null },
    update: { role: role?.trim() || null },
  });
  await recordAudit(ctx.actor, {
    dealId,
    action: "DEAL_CONTACT_ADDED",
    newValue: `${contact.firstName} ${contact.lastName ?? ""}`.trim(),
  });
  emitLeadEvent({ type: "deal.updated", dealId, at: new Date().toISOString(), actor: actorLabel(ctx.actor) });
  return repo.findById(dealId);
}

export async function removeDealContact(dealId: string, contactId: string, ctx: { actor: Actor }) {
  await prisma.dealContact.deleteMany({ where: { dealId, contactId } });
  await recordAudit(ctx.actor, { dealId, action: "DEAL_CONTACT_REMOVED", oldValue: contactId });
  emitLeadEvent({ type: "deal.updated", dealId, at: new Date().toISOString(), actor: actorLabel(ctx.actor) });
  return repo.findById(dealId);
}

export function getDeal(id: string) {
  return repo.findById(id);
}

export async function listDeals(
  query: DealListQuery,
  scope?: import("@prisma/client").Prisma.DealWhereInput,
) {
  const [won, lost] = await Promise.all([getWonStageKeys(), getLostStageKeys()]);
  const stages = await getDealStages();
  const openKeys = stages.filter((s) => !won.includes(s.key) && !lost.includes(s.key)).map((s) => s.key);
  return repo.listDeals(query, openKeys, scope);
}
