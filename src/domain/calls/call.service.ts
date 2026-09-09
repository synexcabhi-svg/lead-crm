/**
 * Calls - phone calls logged against a lead (the Lead "Calls" related list).
 * A call always belongs to a lead; the caller-level RBAC check (can the user
 * see this lead?) is done in the route handlers.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/http";
import type { CallCreateInput, CallUpdateInput } from "./call.schema";

const callSelect = {
  id: true,
  leadId: true,
  subject: true,
  callType: true,
  purpose: true,
  outcome: true,
  callTime: true,
  durationMinutes: true,
  notes: true,
  createdAt: true,
  owner: { select: { id: true, name: true } },
} satisfies Prisma.CallSelect;

const clean = (v?: string | null) => {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
};
const parseWhen = (v?: string) => {
  const s = clean(v);
  return s ? new Date(s) : new Date();
};

export function listCallsForLead(leadId: string) {
  return prisma.call.findMany({
    where: { leadId },
    orderBy: { callTime: "desc" },
    select: callSelect,
  });
}

export function createCall(leadId: string, input: CallCreateInput, ownerId: string) {
  return prisma.call.create({
    data: {
      leadId,
      subject: input.subject.trim(),
      callType: input.callType ?? "outbound",
      purpose: clean(input.purpose),
      outcome: clean(input.outcome),
      callTime: parseWhen(input.callTime),
      durationMinutes: input.durationMinutes ?? null,
      notes: clean(input.notes),
      ownerId,
    },
    select: callSelect,
  });
}

export async function getCall(id: string) {
  const call = await prisma.call.findUnique({
    where: { id },
    select: { ...callSelect, lead: { select: { ownerId: true, technicalMemberId: true } } },
  });
  return call;
}

export async function updateCall(id: string, input: CallUpdateInput) {
  const existing = await prisma.call.findUnique({ where: { id } });
  if (!existing) throw notFound("Call not found");
  const data: Record<string, unknown> = {};
  if (input.subject !== undefined) data.subject = input.subject.trim();
  if (input.callType !== undefined) data.callType = input.callType;
  if (input.purpose !== undefined) data.purpose = clean(input.purpose);
  if (input.outcome !== undefined) data.outcome = clean(input.outcome);
  if (input.callTime !== undefined) data.callTime = parseWhen(input.callTime);
  if (input.durationMinutes !== undefined) data.durationMinutes = input.durationMinutes ?? null;
  if (input.notes !== undefined) data.notes = clean(input.notes);
  return prisma.call.update({ where: { id }, data, select: callSelect });
}

export async function deleteCall(id: string) {
  await prisma.call.deleteMany({ where: { id } });
}
