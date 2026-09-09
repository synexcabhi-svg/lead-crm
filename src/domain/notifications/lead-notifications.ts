/**
 * Turns lead.* events into email notifications for the technical team.
 * Subscribed to the event bus in src/instrumentation.ts.
 *
 * Fires when:
 *   - a lead is assigned / reassigned to a technical member (lead.tech_assigned)
 *   - a lead is created already assigned to a technical member (lead.created)
 *
 * Failures are logged, never re-thrown - notifications must not affect the
 * lead write that triggered them.
 */
import { prisma } from "@/lib/prisma";
import { env } from "@/config/env";
import { sendMail } from "@/lib/mailer";
import type { LeadEvent } from "@/lib/events";

const leadInclude = {
  status: { select: { label: true } },
  source: { select: { label: true } },
  technicalMember: { select: { id: true, name: true, email: true } },
  owner: { select: { name: true } },
};

function assignmentEmail(lead: {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  message: string | null;
  priority: string;
  status: { label: string };
  source: { label: string };
  owner: { name: string } | null;
  technicalMember: { name: string } | null;
}) {
  const name = `${lead.firstName} ${lead.lastName ?? ""}`.trim();
  const url = `${env.appUrl}/leads/${lead.id}`;
  const lines = [
    `Hi ${lead.technicalMember?.name ?? "there"},`,
    ``,
    `A lead has been assigned to you.`,
    ``,
    `  Name:      ${name}`,
    `  Company:   ${lead.company ?? "-"}`,
    `  Email:     ${lead.email ?? "-"}`,
    `  Phone:     ${lead.phone ?? "-"}`,
    `  Source:    ${lead.source.label}`,
    `  Status:    ${lead.status.label}`,
    `  Priority:  ${lead.priority}`,
    `  Owner:     ${lead.owner?.name ?? "Unassigned"}`,
    ``,
    lead.message ? `  Message:   ${lead.message}` : ``,
    ``,
    `Open the lead: ${url}`,
  ].filter((l) => l !== null);

  return {
    subject: `Lead assigned to you: ${name}`,
    text: lines.join("\n"),
    html: `<p>Hi ${lead.technicalMember?.name ?? "there"},</p>
<p>A lead has been assigned to you.</p>
<table cellpadding="4" style="border-collapse:collapse">
<tr><td><b>Name</b></td><td>${escapeHtml(name)}</td></tr>
<tr><td><b>Company</b></td><td>${escapeHtml(lead.company ?? "-")}</td></tr>
<tr><td><b>Email</b></td><td>${escapeHtml(lead.email ?? "-")}</td></tr>
<tr><td><b>Phone</b></td><td>${escapeHtml(lead.phone ?? "-")}</td></tr>
<tr><td><b>Source</b></td><td>${escapeHtml(lead.source.label)}</td></tr>
<tr><td><b>Status</b></td><td>${escapeHtml(lead.status.label)}</td></tr>
<tr><td><b>Priority</b></td><td>${escapeHtml(lead.priority)}</td></tr>
<tr><td><b>Owner</b></td><td>${escapeHtml(lead.owner?.name ?? "Unassigned")}</td></tr>
</table>
${lead.message ? `<p><b>Message:</b> ${escapeHtml(lead.message)}</p>` : ""}
<p><a href="${url}">Open the lead &rarr;</a></p>`,
  };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/**
 * Cross-module-instance idempotency guard: even if the listener is attached
 * more than once (Next dev bundling), a given event sends at most one email.
 */
const g = globalThis as unknown as { __crmNotifySeen?: Map<string, number> };
const seen = g.__crmNotifySeen ?? (g.__crmNotifySeen = new Map<string, number>());
function alreadyHandled(key: string): boolean {
  const now = Date.now();
  for (const [k, t] of seen) if (now - t > 60_000) seen.delete(k);
  if (seen.has(key)) return true;
  seen.set(key, now);
  return false;
}

export async function notifyOnLeadEvent(event: LeadEvent): Promise<void> {
  if (event.type !== "lead.tech_assigned" && event.type !== "lead.created") return;
  if (!event.leadId) return;
  if (env.mail.transport === "off") return;
  if (alreadyHandled(`${event.type}:${event.leadId}:${event.at}`)) return;

  try {
    const lead = await prisma.lead.findUnique({
      where: { id: event.leadId },
      include: leadInclude,
    });
    if (!lead || !lead.technicalMemberId || !lead.technicalMember) return;

    // On create we only care if it came in already assigned.
    if (event.type === "lead.created" && !lead.technicalMemberId) return;

    const to = lead.technicalMember.email?.trim();
    if (!to) {
      console.warn(
        `[notify] lead ${lead.id} assigned to "${lead.technicalMember.name}" but that member has no email set - skipping.`,
      );
      return;
    }

    const mail = assignmentEmail(lead);
    const res = await sendMail({ to, ...mail });
    if (res.ok) {
      console.log(`[notify] assignment email sent to ${to} for lead ${lead.id}`);
    } else {
      console.warn(`[notify] assignment email not sent (${res.skipped}) for lead ${lead.id}`);
    }
  } catch (err) {
    console.error("[notify] failed to process lead event:", err);
  }
}
