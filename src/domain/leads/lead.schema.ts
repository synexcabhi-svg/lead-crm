/**
 * Zod validation schemas - the SINGLE validation contract shared by the admin
 * form, the public form, and the server. Safe to import in client components
 * (no server-only imports here).
 */
import { z } from "zod";
import { LEAD_PRIORITIES } from "./lead.constants";

const name = z.string().trim().min(1, "Required").max(80, "Too long (max 80)");
const optName = z.string().trim().max(80, "Too long (max 80)").optional().or(z.literal(""));
const email = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address")
  .max(180)
  .optional()
  .or(z.literal(""));
// Permissive international phone: digits, spaces, dashes, parens, leading +
const phone = z
  .string()
  .trim()
  .regex(/^[+]?[\d\s().-]{7,20}$/u, "Enter a valid phone number")
  .optional()
  .or(z.literal(""));
const company = z.string().trim().max(120, "Too long (max 120)").optional().or(z.literal(""));
const longText = z.string().trim().max(2000, "Too long (max 2000)").optional().or(z.literal(""));
const place = z.string().trim().max(80, "Too long (max 80)").optional().or(z.literal(""));
const propertyTypeKey = z.string().trim().min(1).max(40).optional().or(z.literal(""));

/** city / state / country / postalCode - present on every lead schema. */
const locationFields = {
  city: place,
  state: place,
  country: place,
  postalCode: z.string().trim().max(20).optional().or(z.literal("")),
};

const atLeastOneContact = <T extends { email?: string; phone?: string }>(v: T, ctx: z.RefinementCtx) => {
  if (!v.email && !v.phone) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide at least an email or a phone number",
      path: ["email"],
    });
  }
};

/** Fields an admin may set when creating or editing a lead. */
export const leadAdminSchema = z
  .object({
    firstName: name,
    lastName: optName,
    email,
    phone,
    company,
    message: longText,
    notes: longText,
    ...locationFields,
    propertyTypeKey,
    priority: z.enum(LEAD_PRIORITIES).optional(),
    statusKey: z.string().trim().min(1).max(40).optional().or(z.literal("")),
    sourceKey: z.string().trim().min(1).max(40).optional().or(z.literal("")),
    ownerId: z.string().trim().min(1).optional().or(z.literal("")),
    technicalMemberId: z.string().trim().min(1).optional().or(z.literal("")),
  })
  .superRefine(atLeastOneContact);

export type LeadAdminInput = z.infer<typeof leadAdminSchema>;

/** Partial schema for PATCH / PUT updates. */
export const leadUpdateSchema = z
  .object({
    firstName: name.optional(),
    lastName: optName,
    email,
    phone,
    company,
    message: longText,
    notes: longText,
    ...locationFields,
    propertyTypeKey,
    priority: z.enum(LEAD_PRIORITIES).optional(),
    statusKey: z.string().trim().min(1).max(40).optional().or(z.literal("")),
    sourceKey: z.string().trim().min(1).max(40).optional().or(z.literal("")),
    ownerId: z.string().trim().optional(),
    technicalMemberId: z.string().trim().optional(),
    isArchived: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update" });

export type LeadUpdateInput = z.infer<typeof leadUpdateSchema>;

/** Fields a visitor may submit through the public website form. */
export const leadPublicSchema = z
  .object({
    firstName: name,
    lastName: optName,
    email,
    phone,
    company,
    message: longText,
    ...locationFields,
    propertyTypeKey,
    consent: z.coerce.boolean().optional(),
    // honeypot: real users never fill this hidden field
    website: z.string().max(0, "spam").optional().or(z.literal("")),
  })
  .superRefine(atLeastOneContact);

export type LeadPublicInput = z.infer<typeof leadPublicSchema>;

/** Query params for the admin lead list. */
export const leadListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(120).optional(),
  status: z.string().trim().optional(),
  source: z.string().trim().optional(),
  owner: z.string().trim().optional(),
  tech: z.string().trim().optional(),
  propertyType: z.string().trim().optional(),
  state: z.string().trim().optional(),
  priority: z.string().trim().optional(),
  archived: z.enum(["true", "false", "all"]).default("false"),
  sortBy: z
    .enum(["createdAt", "updatedAt", "firstName", "lastName", "company", "statusKey", "priority"])
    .default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

export type LeadListQuery = z.infer<typeof leadListQuerySchema>;

/** Normalize "" -> undefined for optional string fields. */
export function blankToUndef<T extends Record<string, unknown>>(obj: T): T {
  const out = { ...obj };
  for (const k of Object.keys(out)) {
    if (out[k] === "") (out as Record<string, unknown>)[k] = undefined;
  }
  return out;
}
