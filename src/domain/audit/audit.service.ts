/**
 * Append-only audit trail. Every lead mutation records who did what, and the
 * before/after value of each changed field.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type Actor =
  | { kind: "user"; userId: string; label: string }
  | { kind: "public" }
  | { kind: "system" };

export function actorLabel(actor: Actor): string {
  if (actor.kind === "user") return `user:${actor.label}`;
  if (actor.kind === "public") return "public-form";
  return "system";
}

export interface AuditEntry {
  leadId?: string;
  dealId?: string;
  action: string;
  field?: string;
  oldValue?: string | null;
  newValue?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export async function recordAudit(
  actor: Actor,
  entries: AuditEntry | AuditEntry[],
  tx: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<void> {
  const list = Array.isArray(entries) ? entries : [entries];
  if (list.length === 0) return;
  await tx.auditLog.createMany({
    data: list.map((e) => ({
      leadId: e.leadId ?? null,
      dealId: e.dealId ?? null,
      userId: actor.kind === "user" ? actor.userId : null,
      actorLabel: actorLabel(actor),
      action: e.action,
      field: e.field ?? null,
      oldValue: e.oldValue ?? null,
      newValue: e.newValue ?? null,
      metadata: e.metadata,
    })),
  });
}

export function getLeadAuditTrail(leadId: string, limit = 100) {
  return prisma.auditLog.findMany({
    where: { leadId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { name: true, email: true } } },
  });
}

export function getDealAuditTrail(dealId: string, limit = 100) {
  return prisma.auditLog.findMany({
    where: { dealId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { name: true, email: true } } },
  });
}
