/**
 * Role-based access control. Four roles, ranked:
 *
 *   SUPER_ADMIN  - everything, incl. managing people & their roles
 *   ADMIN        - all records + config (statuses/sources/stages), hard delete
 *   MANAGER      - all records, assign/convert, manage territories
 *   SALES        - only records they own or are the Sales Team member for
 *
 * Server-only. Routes/services import this; the client gets plain booleans.
 */
import type { Prisma } from "@prisma/client";
import type { SessionUser } from "@/lib/auth";
import { forbidden } from "@/lib/http";

export const ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  MANAGER: "Manager",
  SALES: "Sales",
};

const RANK: Record<Role, number> = { SUPER_ADMIN: 4, ADMIN: 3, MANAGER: 2, SALES: 1 };

export function isRole(v: string): v is Role {
  return (ROLES as readonly string[]).includes(v);
}
function rank(user: { role: string }): number {
  return isRole(user.role) ? RANK[user.role] : 0;
}
export function atLeast(user: { role: string }, role: Role): boolean {
  return rank(user) >= RANK[role];
}

/** Capability checks - use these, never compare role strings inline. */
export const can = {
  /** see every record, not just their own */
  viewAllRecords: (u: { role: string }) => atLeast(u, "MANAGER"),
  /** set a record's Owner to any person */
  reassignOwner: (u: { role: string }) => atLeast(u, "MANAGER"),
  manageTerritories: (u: { role: string }) => atLeast(u, "MANAGER"),
  deleteDeal: (u: { role: string }) => atLeast(u, "MANAGER"),
  /** configure statuses / sources / deal stages */
  manageConfig: (u: { role: string }) => atLeast(u, "ADMIN"),
  /** permanently delete a lead */
  hardDeleteLead: (u: { role: string }) => atLeast(u, "ADMIN"),
  /** create / edit users and change roles */
  managePeople: (u: { role: string }) => u.role === "SUPER_ADMIN",
};

/** true when the user may see/edit this specific record */
export function ownsRecord(
  user: SessionUser,
  record: { ownerId: string | null; technicalMemberId: string | null },
): boolean {
  if (can.viewAllRecords(user)) return true;
  return record.ownerId === user.id || record.technicalMemberId === user.id;
}

export function assertOwnsRecord(
  user: SessionUser,
  record: { ownerId: string | null; technicalMemberId: string | null },
): void {
  if (!ownsRecord(user, record)) throw forbidden("You can only access your own records");
}

/** Prisma `where` fragment that scopes a lead list to what the user may see. */
export function leadScopeWhere(user: SessionUser): Prisma.LeadWhereInput {
  if (can.viewAllRecords(user)) return {};
  return { OR: [{ ownerId: user.id }, { technicalMemberId: user.id }] };
}
export function dealScopeWhere(user: SessionUser): Prisma.DealWhereInput {
  if (can.viewAllRecords(user)) return {};
  return { OR: [{ ownerId: user.id }, { technicalMemberId: user.id }] };
}

/** Flags handed to client components so the UI can hide what the role can't do. */
export function permissionFlags(user: SessionUser) {
  return {
    role: user.role,
    viewAllRecords: can.viewAllRecords(user),
    reassignOwner: can.reassignOwner(user),
    manageTerritories: can.manageTerritories(user),
    manageConfig: can.manageConfig(user),
    hardDeleteLead: can.hardDeleteLead(user),
    deleteDeal: can.deleteDeal(user),
    managePeople: can.managePeople(user),
  };
}
export type PermissionFlags = ReturnType<typeof permissionFlags>;
