/**
 * LeadService - the SINGLE place leads are created, updated, assigned or
 * archived. Both the admin API (/api/leads) and the public API
 * (/api/public/leads) go through here. There is exactly one code path and
 * one database table for leads.
 *
 * Responsibilities:
 *   - normalize + resolve defaults (status, source, priority)
 *   - validate foreign references (status/source/owner exist)
 *   - apply the configured duplicate strategy
 *   - persist via LeadRepository
 *   - write the audit trail
 *   - emit realtime events for the dashboard
 */
import { prisma } from "@/lib/prisma";
import { env } from "@/config/env";
import { emitLeadEvent, type LeadEventType } from "@/lib/events";
// side-effect: wires the lead-assignment email notifier onto the event bus
import "@/domain/notifications/register";
import { badRequest, notFound } from "@/lib/http";
import {
  recordAudit,
  actorLabel,
  type Actor,
  type AuditEntry,
} from "@/domain/audit/audit.service";
import {
  assertSourceKey,
  assertStatusKey,
  getDefaultStatusKey,
  getStatuses,
} from "@/domain/statuses/status.service";
import { assertTechnicalMember } from "@/domain/team/team.service";
import { assertPropertyTypeKey } from "@/domain/property/property-type.service";
import { resolveTechnicalMemberForLocation } from "@/domain/team/territory.service";
import {
  AUDIT_ACTIONS,
  DEFAULT_PRIORITY,
  MANUAL_SOURCE_KEY,
  PUBLIC_FORM_SOURCE_KEY,
  type LeadPriority,
} from "./lead.constants";
import { DuplicateLeadError } from "./lead.errors";
import { resolveDuplicateAction } from "./lead.dedupe";
import * as repo from "./lead.repository";
import type { LeadListQuery } from "./lead.schema";

export interface CreateLeadInput {
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  message?: string;
  notes?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  propertyTypeKey?: string;
  priority?: LeadPriority;
  statusKey?: string;
  sourceKey?: string;
  ownerId?: string;
  technicalMemberId?: string;
  consent?: boolean;
  ipAddress?: string;
  userAgent?: string;
}

export interface UpdateLeadInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  message?: string;
  notes?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  propertyTypeKey?: string;
  priority?: LeadPriority;
  statusKey?: string;
  sourceKey?: string;
  ownerId?: string | null;
  technicalMemberId?: string | null;
  isArchived?: boolean;
}

type Origin = "admin" | "public";

const clean = (v?: string | null) => {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
};

async function assertOwner(ownerId: string): Promise<void> {
  const owner = await prisma.user.findFirst({ where: { id: ownerId, isActive: true } });
  if (!owner) throw badRequest(`Unknown or inactive owner: ${ownerId}`, { field: "ownerId" });
}

/* -------------------------------------------------------------------------- */
/*  CREATE                                                                     */
/* -------------------------------------------------------------------------- */

export async function createLead(
  input: CreateLeadInput,
  ctx: { actor: Actor; origin: Origin },
): Promise<{ lead: repo.LeadWithRelations; deduped: "created" | "flagged" | "merged" }> {
  const email = clean(input.email)?.toLowerCase() ?? null;
  const phone = clean(input.phone);

  const sourceKey =
    clean(input.sourceKey) ?? (ctx.origin === "public" ? PUBLIC_FORM_SOURCE_KEY : MANUAL_SOURCE_KEY);
  await assertSourceKey(sourceKey);

  const statusKey = clean(input.statusKey) ?? (await getDefaultStatusKey());
  await assertStatusKey(statusKey);

  // Owner defaults to the person creating the lead (admin UI); public-form
  // leads have no creator so they start unassigned.
  const ownerId =
    clean(input.ownerId) ??
    (ctx.origin === "admin" && ctx.actor.kind === "user" ? ctx.actor.userId : null);
  if (ownerId) await assertOwner(ownerId);

  const propertyTypeKey = clean(input.propertyTypeKey);
  if (propertyTypeKey) await assertPropertyTypeKey(propertyTypeKey);

  const city = clean(input.city);
  const state = clean(input.state);
  const country = clean(input.country);

  let technicalMemberId = clean(input.technicalMemberId);
  if (technicalMemberId) {
    await assertTechnicalMember(technicalMemberId);
  }
  // Territory auto-routing: only when nobody was picked explicitly.
  let autoAssignedByTerritory = false;
  if (!technicalMemberId) {
    const routed = await resolveTechnicalMemberForLocation({ city, state, country });
    if (routed) {
      technicalMemberId = routed;
      autoAssignedByTerritory = true;
    }
  }

  // ---- duplicate strategy -------------------------------------------------
  const existing = await repo.findDuplicate({ email, phone });
  const decision = resolveDuplicateAction(
    env.duplicate.strategy,
    existing ? { id: existing.id, email: existing.email, phone: existing.phone } : null,
    { email, phone },
    env.duplicate.matchFields,
  );

  if (decision.action === "reject") {
    throw new DuplicateLeadError(decision.existingId, decision.matchedOn);
  }

  if (decision.action === "merge") {
    const merged = await mergeIntoExisting(decision.existingId, input, ctx.actor, decision.matchedOn);
    return { lead: merged, deduped: "merged" };
  }

  // ---- create -----------------------------------------------------------
  const lead = await repo.createLead({
    firstName: input.firstName.trim(),
    lastName: clean(input.lastName),
    email,
    phone,
    company: clean(input.company),
    message: clean(input.message),
    notes: clean(input.notes),
    city,
    state,
    country,
    postalCode: clean(input.postalCode),
    propertyTypeKey: propertyTypeKey ?? null,
    priority: input.priority ?? DEFAULT_PRIORITY,
    statusKey,
    sourceKey,
    ownerId: ownerId ?? null,
    technicalMemberId: technicalMemberId ?? null,
    consent: input.consent ?? false,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
    isDuplicate: decision.action === "create" && decision.flagDuplicate,
    duplicateOfId: decision.action === "create" && decision.flagDuplicate ? decision.duplicateOfId : null,
  });

  await recordAudit(ctx.actor, [
    {
      leadId: lead.id,
      action: AUDIT_ACTIONS.CREATED,
      newValue: `${lead.firstName} ${lead.lastName ?? ""}`.trim(),
      metadata: {
        origin: ctx.origin,
        source: sourceKey,
        flaggedDuplicate: decision.action === "create" ? decision.flagDuplicate : false,
        autoAssignedByTerritory,
        ...(decision.action === "create" && decision.flagDuplicate
          ? { duplicateOfId: decision.duplicateOfId, matchedOn: decision.matchedOn }
          : {}),
      },
    },
    ...(autoAssignedByTerritory && technicalMemberId
      ? [
          {
            leadId: lead.id,
            action: AUDIT_ACTIONS.TECH_ASSIGNED,
            field: "technicalMemberId",
            newValue: technicalMemberId,
            metadata: { auto: true, by: "territory", location: { city, state, country } },
          },
        ]
      : []),
  ]);

  emitLeadEvent({
    type: "lead.created",
    leadId: lead.id,
    at: new Date().toISOString(),
    actor: actorLabel(ctx.actor),
  });

  return { lead, deduped: decision.action === "create" && decision.flagDuplicate ? "flagged" : "created" };
}

async function mergeIntoExisting(
  existingId: string,
  input: CreateLeadInput,
  actor: Actor,
  matchedOn: string[],
): Promise<repo.LeadWithRelations> {
  const current = await repo.findById(existingId);
  if (!current) throw notFound(`Lead ${existingId} not found`);

  // fill only blank fields on the existing lead
  const patch: Record<string, string | null> = {};
  const consider: Array<[keyof CreateLeadInput, keyof typeof current]> = [
    ["lastName", "lastName"],
    ["email", "email"],
    ["phone", "phone"],
    ["company", "company"],
    ["message", "message"],
  ];
  for (const [inKey, curKey] of consider) {
    const incoming = clean(input[inKey] as string | undefined);
    if (incoming && !current[curKey]) patch[curKey as string] = incoming;
  }

  const updated = Object.keys(patch).length
    ? await repo.updateLead(existingId, patch)
    : current;

  await recordAudit(actor, {
    leadId: existingId,
    action: AUDIT_ACTIONS.MERGED,
    metadata: { matchedOn, filledFields: Object.keys(patch) },
  });

  emitLeadEvent({
    type: "lead.updated",
    leadId: existingId,
    at: new Date().toISOString(),
    actor: actorLabel(actor),
    changed: Object.keys(patch),
  });

  return updated;
}

/* -------------------------------------------------------------------------- */
/*  UPDATE                                                                     */
/* -------------------------------------------------------------------------- */

export async function updateLead(
  id: string,
  input: UpdateLeadInput,
  ctx: { actor: Actor },
): Promise<repo.LeadWithRelations> {
  const current = await repo.findById(id);
  if (!current) throw notFound(`Lead ${id} not found`);

  if (input.statusKey && input.statusKey !== current.statusKey) await assertStatusKey(input.statusKey);
  if (input.sourceKey && input.sourceKey !== current.sourceKey) await assertSourceKey(input.sourceKey);
  if (input.ownerId) await assertOwner(input.ownerId);
  if (input.technicalMemberId) await assertTechnicalMember(input.technicalMemberId);
  if (input.propertyTypeKey) await assertPropertyTypeKey(input.propertyTypeKey);

  const data: Record<string, unknown> = {};
  const audits: AuditEntry[] = [];
  const changed: string[] = [];

  const setField = (field: keyof UpdateLeadInput, dbValue: unknown, oldValue: unknown) => {
    data[field] = dbValue;
    changed.push(field);
    let action: string = AUDIT_ACTIONS.UPDATED;
    if (field === "statusKey") action = AUDIT_ACTIONS.STATUS_CHANGED;
    if (field === "ownerId") action = AUDIT_ACTIONS.ASSIGNED;
    if (field === "technicalMemberId") action = AUDIT_ACTIONS.TECH_ASSIGNED;
    if (field === "isArchived") action = dbValue ? AUDIT_ACTIONS.ARCHIVED : AUDIT_ACTIONS.UPDATED;
    audits.push({
      leadId: id,
      action,
      field,
      oldValue: oldValue == null ? null : String(oldValue),
      newValue: dbValue == null ? null : String(dbValue),
    });
  };

  const strFields: Array<keyof UpdateLeadInput> = [
    "firstName",
    "lastName",
    "email",
    "phone",
    "company",
    "message",
    "notes",
    "city",
    "state",
    "country",
    "postalCode",
    "propertyTypeKey",
    "priority",
    "statusKey",
    "sourceKey",
  ];
  for (const f of strFields) {
    if (input[f] === undefined) continue;
    const next = f === "priority" ? (input[f] as string) : clean(input[f] as string | undefined);
    const normNext = f === "email" ? next?.toLowerCase() ?? null : next;
    if ((current as Record<string, unknown>)[f] !== normNext) {
      setField(f, normNext, (current as Record<string, unknown>)[f]);
    }
  }

  if (input.ownerId !== undefined) {
    const next = input.ownerId === "" ? null : input.ownerId;
    if (current.ownerId !== next) setField("ownerId", next, current.ownerId);
  }
  if (input.technicalMemberId !== undefined) {
    const next = input.technicalMemberId === "" ? null : input.technicalMemberId;
    if (current.technicalMemberId !== next) {
      setField("technicalMemberId", next, current.technicalMemberId);
    }
  }
  if (input.isArchived !== undefined && input.isArchived !== current.isArchived) {
    setField("isArchived", input.isArchived, current.isArchived);
  }

  // Territory auto-routing on update: only if the location changed AND the lead
  // still has no technical member (and this update didn't set one).
  const locationChanged = ["city", "state", "country"].some((f) => changed.includes(f));
  const techUnset = data.technicalMemberId === undefined && current.technicalMemberId == null;
  if (locationChanged && techUnset) {
    const routed = await resolveTechnicalMemberForLocation({
      city: (data.city as string | null | undefined) ?? current.city,
      state: (data.state as string | null | undefined) ?? current.state,
      country: (data.country as string | null | undefined) ?? current.country,
    });
    if (routed) {
      data.technicalMemberId = routed;
      changed.push("technicalMemberId");
      audits.push({
        leadId: id,
        action: AUDIT_ACTIONS.TECH_ASSIGNED,
        field: "technicalMemberId",
        oldValue: null,
        newValue: routed,
        metadata: { auto: true, by: "territory" },
      });
    }
  }

  if (changed.length === 0) return current;

  const updated = await repo.updateLead(id, data);
  await recordAudit(ctx.actor, audits);

  const type: LeadEventType = changed.includes("statusKey")
    ? "lead.status_changed"
    : changed.includes("ownerId")
      ? "lead.assigned"
      : changed.includes("technicalMemberId")
        ? "lead.tech_assigned"
        : changed.includes("isArchived") && input.isArchived
          ? "lead.archived"
          : "lead.updated";

  emitLeadEvent({
    type,
    leadId: id,
    at: new Date().toISOString(),
    actor: actorLabel(ctx.actor),
    changed,
  });

  return updated;
}

/* -------------------------------------------------------------------------- */
/*  ARCHIVE / DELETE                                                           */
/* -------------------------------------------------------------------------- */

export async function archiveLead(id: string, ctx: { actor: Actor }) {
  return updateLead(id, { isArchived: true }, ctx);
}

/** Hard delete - ADMIN only (enforced at the route). Audit row is kept (leadId set null). */
export async function deleteLead(id: string, ctx: { actor: Actor }): Promise<void> {
  const current = await repo.findById(id);
  if (!current) throw notFound(`Lead ${id} not found`);

  await recordAudit(ctx.actor, {
    leadId: id,
    action: AUDIT_ACTIONS.DELETED,
    oldValue: `${current.firstName} ${current.lastName ?? ""}`.trim(),
    metadata: { email: current.email, phone: current.phone },
  });
  await prisma.lead.delete({ where: { id } });

  emitLeadEvent({
    type: "lead.deleted",
    leadId: id,
    at: new Date().toISOString(),
    actor: actorLabel(ctx.actor),
  });
}

/* -------------------------------------------------------------------------- */
/*  READ                                                                       */
/* -------------------------------------------------------------------------- */

export function getLead(id: string) {
  return repo.findById(id);
}
export function listLeads(query: LeadListQuery, scope?: import("@prisma/client").Prisma.LeadWhereInput) {
  return repo.listLeads(query, scope);
}
export { getStatuses };
