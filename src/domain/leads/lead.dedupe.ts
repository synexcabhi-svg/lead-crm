/**
 * Pure duplicate-resolution logic (no DB) so it can be unit-tested in isolation.
 */
import type { DuplicateStrategy } from "@/config/env";

export interface DedupeCandidate {
  email?: string | null;
  phone?: string | null;
}

export type DedupeDecision =
  | { action: "create"; flagDuplicate: false }
  | { action: "create"; flagDuplicate: true; duplicateOfId: string; matchedOn: string[] }
  | { action: "reject"; existingId: string; matchedOn: string[] }
  | { action: "merge"; existingId: string; matchedOn: string[] };

export function matchedFields(
  incoming: DedupeCandidate,
  existing: DedupeCandidate,
  fields: Array<"email" | "phone">,
): string[] {
  const hits: string[] = [];
  if (fields.includes("email") && incoming.email && existing.email && incoming.email.toLowerCase() === existing.email.toLowerCase()) {
    hits.push("email");
  }
  if (fields.includes("phone") && incoming.phone && existing.phone && normalizePhone(incoming.phone) === normalizePhone(existing.phone)) {
    hits.push("phone");
  }
  return hits;
}

export function normalizePhone(p: string): string {
  return p.replace(/[^\d+]/g, "");
}

/**
 * Given the configured strategy and the existing lead (or null), decide what
 * to do with the incoming lead.
 */
export function resolveDuplicateAction(
  strategy: DuplicateStrategy,
  existing: ({ id: string } & DedupeCandidate) | null,
  incoming: DedupeCandidate,
  matchFields: Array<"email" | "phone">,
): DedupeDecision {
  if (!existing || strategy === "allow") return { action: "create", flagDuplicate: false };

  const matchedOn = matchedFields(incoming, existing, matchFields);
  if (matchedOn.length === 0) return { action: "create", flagDuplicate: false };

  switch (strategy) {
    case "reject":
      return { action: "reject", existingId: existing.id, matchedOn };
    case "update":
      return { action: "merge", existingId: existing.id, matchedOn };
    case "flag":
    default:
      return { action: "create", flagDuplicate: true, duplicateOfId: existing.id, matchedOn };
  }
}
