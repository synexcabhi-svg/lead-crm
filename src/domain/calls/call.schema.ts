/**
 * Zod schemas for the Calls related list on a lead. Client-safe (zod only).
 */
import { z } from "zod";

export const CALL_TYPES = ["outbound", "inbound", "missed"] as const;
export const CALL_TYPE_LABELS: Record<string, string> = {
  outbound: "Outbound",
  inbound: "Inbound",
  missed: "Missed",
};

export const CALL_PURPOSES = [
  "Prospecting",
  "Follow-up",
  "Demo",
  "Site visit",
  "Negotiation",
  "Administrative",
  "Other",
] as const;

export const CALL_OUTCOMES = [
  "Connected",
  "No answer",
  "Left voicemail",
  "Busy",
  "Callback requested",
  "Interested",
  "Not interested",
  "Wrong number",
] as const;

const short = z.string().trim().max(120);
const long = z.string().trim().max(2000).optional().or(z.literal(""));
const optPick = z.string().trim().max(60).optional().or(z.literal(""));
const isoDateTime = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/u, "Pick a date and time")
  .optional()
  .or(z.literal(""));

export const callCreateSchema = z.object({
  subject: short.min(1, "Subject is required"),
  callType: z.enum(CALL_TYPES).default("outbound"),
  purpose: optPick,
  outcome: optPick,
  callTime: isoDateTime,
  durationMinutes: z.coerce.number().int().min(0).max(1440).optional(),
  notes: long,
});
export type CallCreateInput = z.infer<typeof callCreateSchema>;

export const callUpdateSchema = z
  .object({
    subject: short.min(1).optional(),
    callType: z.enum(CALL_TYPES).optional(),
    purpose: optPick,
    outcome: optPick,
    callTime: isoDateTime,
    durationMinutes: z.coerce.number().int().min(0).max(1440).optional(),
    notes: long,
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No changes" });
export type CallUpdateInput = z.infer<typeof callUpdateSchema>;
