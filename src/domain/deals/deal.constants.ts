export const DEAL_AUDIT_ACTIONS = {
  CREATED: "DEAL_CREATED",
  UPDATED: "DEAL_UPDATED",
  STAGE_CHANGED: "DEAL_STAGE_CHANGED",
  ASSIGNED: "DEAL_ASSIGNED",
  DELETED: "DEAL_DELETED",
  CREATED_FROM_LEAD: "DEAL_CREATED_FROM_LEAD",
} as const;

export const LEAD_CONVERTED_ACTION = "LEAD_CONVERTED";
export const ACCOUNT_CREATED_ACTION = "ACCOUNT_CREATED";

export const DEALS_PAGE_SIZE_DEFAULT = 20;
export const DEALS_PAGE_SIZE_MAX = 100;

export const DEAL_SORT_FIELDS = [
  "createdAt",
  "updatedAt",
  "name",
  "amount",
  "stageKey",
  "expectedCloseDate",
] as const;
export type DealSortField = (typeof DEAL_SORT_FIELDS)[number];

export const DEFAULT_CURRENCY = "INR";
