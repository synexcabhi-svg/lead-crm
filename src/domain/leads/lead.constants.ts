/**
 * Values that are enums in code (not user-configurable at runtime).
 * Statuses and sources are configurable and live in the database instead -
 * see src/domain/statuses.
 */

export const LEAD_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type LeadPriority = (typeof LEAD_PRIORITIES)[number];
export const DEFAULT_PRIORITY: LeadPriority = "MEDIUM";

export const USER_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES"] as const;

export const AUDIT_ACTIONS = {
  CREATED: "LEAD_CREATED",
  UPDATED: "LEAD_UPDATED",
  STATUS_CHANGED: "LEAD_STATUS_CHANGED",
  ASSIGNED: "LEAD_ASSIGNED",
  TECH_ASSIGNED: "LEAD_TECH_ASSIGNED",
  ARCHIVED: "LEAD_ARCHIVED",
  DELETED: "LEAD_DELETED",
  MERGED: "LEAD_MERGED",
} as const;

/** Source key forced on leads that arrive through the public website form. */
export const PUBLIC_FORM_SOURCE_KEY = "public_form";
/** Source key used when an admin creates a lead by hand and picks nothing. */
export const MANUAL_SOURCE_KEY = "manual";

export const LEADS_PAGE_SIZE_DEFAULT = 20;
export const LEADS_PAGE_SIZE_MAX = 100;

export const LEAD_SORT_FIELDS = [
  "createdAt",
  "updatedAt",
  "firstName",
  "lastName",
  "company",
  "statusKey",
  "priority",
] as const;
export type LeadSortField = (typeof LEAD_SORT_FIELDS)[number];
