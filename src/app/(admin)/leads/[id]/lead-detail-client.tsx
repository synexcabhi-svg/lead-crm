"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { LeadForm, type LeadFormMeta } from "@/components/LeadForm";
import { ConvertLeadPanel, type ConvertMeta } from "@/components/ConvertLeadPanel";
import { CallsPanel } from "@/components/CallsPanel";
import { StatusBadge, PriorityPill } from "@/components/StatusBadge";
import { Toast } from "@/components/ui";

interface LeadDto {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  message: string | null;
  notes: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  propertyTypeKey: string | null;
  priority: string;
  statusKey: string;
  sourceKey: string;
  ownerId: string | null;
  technicalMemberId: string | null;
  isDuplicate: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  convertedAt: string | null;
  status: { label: string; color: string; isConverted?: boolean };
  source: { label: string; color: string };
  propertyType: { key: string; label: string; category: string | null } | null;
  owner: { name: string; email: string } | null;
  technicalMember: { id: string; name: string; color: string } | null;
  duplicateOf: { id: string; firstName: string; lastName: string | null } | null;
  convertedAccount: { id: string; name: string } | null;
  convertedContact: { id: string; firstName: string; lastName: string | null } | null;
  convertedDeal: { id: string; name: string; amount: number | null; currency: string } | null;
}
interface AuditDto {
  id: string;
  action: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  actorLabel: string;
  createdAt: string;
  user: { name: string } | null;
}
interface CallDto {
  id: string;
  subject: string;
  callType: string;
  purpose: string | null;
  outcome: string | null;
  callTime: string;
  durationMinutes: number | null;
  notes: string | null;
  owner: { id: string; name: string } | null;
}

export function LeadDetailClient({
  lead,
  audit,
  calls,
  meta,
  perms,
}: {
  lead: LeadDto;
  audit: AuditDto[];
  calls: CallDto[];
  meta: LeadFormMeta & ConvertMeta;
  perms: { hardDeleteLead: boolean; reassignOwner: boolean };
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: "info" | "error" } | null>(null);

  async function del() {
    if (!confirm("Permanently delete this lead? This cannot be undone.")) return;
    try {
      await api(`/api/leads/${lead.id}?hard=true`, { method: "DELETE" });
      router.push("/leads");
      router.refresh();
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : "Delete failed", kind: "error" });
    }
  }
  async function toggleArchive() {
    try {
      await api(`/api/leads/${lead.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isArchived: !lead.isArchived }),
      });
      router.refresh();
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : "Failed", kind: "error" });
    }
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h1 style={{ marginBottom: 2 }}>
            {lead.firstName} {lead.lastName ?? ""}
          </h1>
          <span className="muted">
            <Link href="/leads">Leads</Link> / {lead.id}
          </span>
        </div>
        <div className="row" style={{ flex: "unset", gap: 8 }}>
          <button className="btn sm" onClick={() => setEditing((v) => !v)}>
            {editing ? "Cancel" : "Edit"}
          </button>
          <button className="btn sm" onClick={toggleArchive}>
            {lead.isArchived ? "Unarchive" : "Archive"}
          </button>
          {perms.hardDeleteLead ? (
            <button className="btn sm danger" onClick={del}>
              Delete
            </button>
          ) : null}
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <ConvertLeadPanel
          lead={lead}
          meta={{ dealStages: meta.dealStages, accounts: meta.accounts, owners: meta.owners }}
        />
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h2>Details</h2>
          {editing ? (
            <LeadForm
              mode="edit"
              meta={meta}
              initial={lead}
              onSuccess={() => {
                setEditing(false);
                router.refresh();
                setToast({ msg: "Lead updated", kind: "info" });
              }}
            />
          ) : (
            <dl style={{ display: "grid", gridTemplateColumns: "120px 1fr", rowGap: 8, margin: 0 }}>
              <dt className="muted">Status</dt>
              <dd style={{ margin: 0 }}>
                <StatusBadge label={lead.status.label} color={lead.status.color} />
              </dd>
              <dt className="muted">Priority</dt>
              <dd style={{ margin: 0 }}>
                <PriorityPill value={lead.priority} />
              </dd>
              <dt className="muted">Email</dt>
              <dd style={{ margin: 0 }}>{lead.email ?? "-"}</dd>
              <dt className="muted">Phone</dt>
              <dd style={{ margin: 0 }}>{lead.phone ?? "-"}</dd>
              <dt className="muted">Company</dt>
              <dd style={{ margin: 0 }}>{lead.company ?? "-"}</dd>
              <dt className="muted">Location</dt>
              <dd style={{ margin: 0 }}>
                {[lead.city, lead.state, lead.country].filter(Boolean).join(", ") || "-"}
                {lead.postalCode ? ` (${lead.postalCode})` : ""}
              </dd>
              <dt className="muted">Source</dt>
              <dd style={{ margin: 0 }}>
                <StatusBadge label={lead.source.label} color={lead.source.color} />
              </dd>
              <dt className="muted">Property type</dt>
              <dd style={{ margin: 0 }}>
                {lead.propertyType
                  ? lead.propertyType.category
                    ? `${lead.propertyType.category} — ${lead.propertyType.label}`
                    : lead.propertyType.label
                  : "-"}
              </dd>
              <dt className="muted">Owner</dt>
              <dd style={{ margin: 0 }}>
                {lead.owner ? (
                  <StatusBadge
                    label={lead.owner.name}
                    color={meta.owners.find((o) => o.name === lead.owner!.name)?.color}
                  />
                ) : (
                  "Unassigned"
                )}
              </dd>
              <dt className="muted">Sales Team</dt>
              <dd style={{ margin: 0 }}>
                {lead.technicalMember ? (
                  <StatusBadge label={lead.technicalMember.name} color={lead.technicalMember.color} />
                ) : (
                  "Unassigned"
                )}
              </dd>
              <dt className="muted">Message</dt>
              <dd style={{ margin: 0 }}>{lead.message ?? "-"}</dd>
              <dt className="muted">Notes</dt>
              <dd style={{ margin: 0 }}>{lead.notes ?? "-"}</dd>
              <dt className="muted">Created</dt>
              <dd style={{ margin: 0 }}>{new Date(lead.createdAt).toLocaleString()}</dd>
              {lead.isDuplicate && lead.duplicateOf ? (
                <>
                  <dt className="muted">Duplicate of</dt>
                  <dd style={{ margin: 0 }}>
                    <Link href={`/leads/${lead.duplicateOf.id}`}>
                      {lead.duplicateOf.firstName} {lead.duplicateOf.lastName ?? ""}
                    </Link>
                  </dd>
                </>
              ) : null}
            </dl>
          )}
        </div>

        <div className="card">
          <h2>Audit trail</h2>
          <div className="stack" style={{ gap: 10 }}>
            {audit.map((a) => (
              <div key={a.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
                <strong>{a.action.replace("LEAD_", "").replace("_", " ").toLowerCase()}</strong>
                {a.field ? (
                  <span className="muted">
                    {" "}
                    — {a.field}: {a.oldValue ?? "∅"} → {a.newValue ?? "∅"}
                  </span>
                ) : null}
                <br />
                <span className="hint">
                  {a.user?.name ?? a.actorLabel} · {new Date(a.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
            {audit.length === 0 ? <p className="muted">No history yet.</p> : null}
          </div>
        </div>
      </div>

      <CallsPanel leadId={lead.id} initial={calls} />

      {toast ? <Toast message={toast.msg} kind={toast.kind} onDone={() => setToast(null)} /> : null}
    </>
  );
}
