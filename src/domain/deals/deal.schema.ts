/**
 * Zod schemas for deals + lead conversion. Client-safe (zod only).
 */
import { z } from "zod";

const dealName = z.string().trim().min(1, "Required").max(140, "Too long (max 140)");
const amount = z.coerce.number().int("Whole numbers only").min(0, "Must be 0 or more").max(1_000_000_000).optional();
const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, "Use YYYY-MM-DD")
  .optional()
  .or(z.literal(""));
const optId = z.string().trim().optional().or(z.literal(""));
const longText = z.string().trim().max(2000).optional().or(z.literal(""));
const place = z.string().trim().max(80).optional().or(z.literal(""));
const locationFields = {
  city: place,
  state: place,
  country: place,
  postalCode: z.string().trim().max(20).optional().or(z.literal("")),
};

export const dealCreateSchema = z.object({
  name: dealName,
  accountId: z.string().trim().min(1, "Pick an account"),
  amount,
  currency: z.string().trim().max(8).optional(),
  stageKey: z.string().trim().min(1).max(40).optional(),
  primaryContactId: optId,
  ownerId: optId,
  technicalMemberId: optId,
  expectedCloseDate: isoDate,
  notes: longText,
  ...locationFields,
});
export type DealCreateInput = z.infer<typeof dealCreateSchema>;

export const dealUpdateSchema = z
  .object({
    name: dealName.optional(),
    amount,
    currency: z.string().trim().max(8).optional(),
    stageKey: z.string().trim().min(1).max(40).optional(),
    accountId: z.string().trim().min(1).optional(),
    primaryContactId: z.string().trim().optional(),
    ownerId: z.string().trim().optional(),
    technicalMemberId: z.string().trim().optional(),
    expectedCloseDate: isoDate,
    notes: longText,
    ...locationFields,
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update" });
export type DealUpdateInput = z.infer<typeof dealUpdateSchema>;

export const dealListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(120).optional(),
  stage: z.string().trim().optional(),
  account: z.string().trim().optional(),
  owner: z.string().trim().optional(),
  tech: z.string().trim().optional(),
  open: z.enum(["true", "false", "all"]).default("all"),
  sortBy: z
    .enum(["createdAt", "updatedAt", "name", "amount", "stageKey", "expectedCloseDate"])
    .default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});
export type DealListQuery = z.infer<typeof dealListQuerySchema>;

/**
 * Payload for POST /api/leads/:id/convert - Zoho-style lead conversion.
 * The lead's person -> Contact, company -> Account, and (optionally) a Deal.
 */
export const convertLeadSchema = z.object({
  // account: use an existing one, or create a new one with this name
  accountId: optId,
  accountName: z.string().trim().max(140).optional().or(z.literal("")),
  // deal (optional - you can convert without creating a deal)
  createDeal: z.coerce.boolean().default(true),
  dealName: z.string().trim().max(140).optional().or(z.literal("")),
  amount,
  stageKey: z.string().trim().max(40).optional().or(z.literal("")),
  expectedCloseDate: isoDate,
  ownerId: optId,
});
export type ConvertLeadInput = z.infer<typeof convertLeadSchema>;
