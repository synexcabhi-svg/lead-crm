"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/lib/client";
import { Field, Toast } from "@/components/ui";
import { ColorSelect, ColorTag } from "@/components/ColorSelect";
import { money, date, dateTime } from "@/lib/format";

interface DealDto {
  id: string;
  name: string;
  amount: number | null;
  currency: string;
  stageKey: string;
  accountId: string;
  primaryContactId: string | null;
  ownerId: string | null;
  technicalMemberId: string | null;
  expectedCloseDate: string | null;
  closedAt: string | null;
  notes: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  createdAt: string;
  stage: { label: string; isWon: boolean; isLost: boolean };
  account: { id: string; name: string };
  primaryContact: { id: string; firstName: string; lastName: string | null } | null;
  owner: { id: string; name: string } | null;
  technicalMember: { id: string; name: string; color: string } | null;
  sourceLead: { id: string; firstName: string; lastName: string | null } | null;
  associatedContacts: {
    id: string;
    role: string | null;
    isPrimary: boolean;
    contact: { id: string; firstName: string; lastName: string | null; email: string | null; phone: string | null };
  }[];
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
interface Meta {
  stages: { key: string; label: string }[];
  owners: { id: string; name: string; color?: string }[];
  technicalMembers: { id: string; name: string; color?: string }[];
  contacts: { id: string; name: string }[];
}

export function DealDetailClient({
  deal,
  audit,
  meta,
  perms,
}: {
  deal: DealDto;
  audit: AuditDto[];
  meta: Meta;
  perms: { deleteDeal: boolean; reassignOwner: boolean };
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: "info" | "error" } | null>(null);
  const [form, setForm] = useState({
    name: deal.name,
    amount: deal.amount == null ? "" : String(deal.amount),
    stageKey: deal.stageKey,
    ownerId: deal.ownerId ?? "",
    technicalMemberId: deal.technicalMemberId ?? "",
    primaryContactId: deal.primaryContactId ?? "",
    expectedCloseDate: deal.expectedCloseDate ? deal.expectedCloseDate.slice(0, 10) : "",
    notes: deal.notes ?? "",
    city: deal.city ?? "",
    state: deal.state ?? "",
    country: deal.country ?? "",
    postalCode: deal.postalCode ?? "",
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const linkedIds = new Set(deal.associatedContacts.map((a) => a.contact.id));
  const addableContacts = meta.contacts.filter((c) => !linkedIds.has(c.id));
  const [addContactId, setAddContactId] = useState("");
  const [addRole, setAddRole] = useState("");

  async function addContact() {
    if (!addContactId) return;
    try {
      await api(`/api/deals/${deal.id}/contacts`, {
        method: "POST",
        body: JSON.stringify({ contactId: addContactId, role: addRole || undefined }),
      });
      setAddContactId("");
      setAddRole("");
      router.refresh();
      setToast({ msg: "Contact linked to opportunity", kind: "info" });
    } catch (e) {
      setToast({ msg: e instanceof ApiClientError ? e.message : "Failed", kind: "error" });
    }
  }
  async function removeContact(contactId: string) {
    try {
      await api(`/api/deals/${deal.id}/contacts/${contactId}`, { method: "DELETE" });
      router.refresh();
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : "Failed", kind: "error" });
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/api/deals/${deal.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name,
          amount: form.amount === "" ? undefined : Number(form.amount),
          stageKey: form.stageKey,
          ownerId: form.ownerId,
          technicalMemberId: form.technicalMemberId,
          primaryContactId: form.primaryContactId,
          expectedCloseDate: form.expectedCloseDate,
          notes: form.notes,
          city: form.city,
          state: form.state,
          country: form.country,
          postalCode: form.postalCode,
        }),
      });
      setEditing(false);
      router.refresh();
      setToast({ msg: "Opportunity updated", kind: "info" });
    } catch (e2) {
      setToast({ msg: e2 instanceof ApiClientError ? e2.message : "Update failed", kind: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this opportunity?")) return;
    try {
      await api(`/api/deals/${deal.id}`, { method: "DELETE" });
      router.push("/deals");
      router.refresh();
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : "Delete failed", kind: "error" });
    }
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h1 style={{ marginBottom: 2 }}>{deal.name}</h1>
          <span className="muted">
            <Link href="/deals">Opportunities</Link> / <Link href={`/accounts/${deal.account.id}`}>{deal.account.name}</Link>
          </span>
        </div>
        <div className="row" style={{ flex: "unset", gap: 8 }}>
          <button className="btn sm" onClick={() => setEditing((v) => !v)}>
            {editing ? "Cancel" : "Edit"}
          </button>
          {perms.deleteDeal ? (
            <button className="btn sm danger" onClick={remove}>
              Delete
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h2>Details</h2>
          {editing ? (
            <form onSubmit={save} noValidate>
              <Field label="Name">
                <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} />
              </Field>
              <div className="row">
                <Field label="Amount (INR)">
                  <input
                    className="input"
                    inputMode="numeric"
                    value={form.amount}
                    onChange={(e) => set("amount", e.target.value.replace(/[^\d]/g, ""))}
                  />
                </Field>
                <Field label="Stage">
                  <select className="select" value={form.stageKey} onChange={(e) => set("stageKey", e.target.value)}>
                    {meta.stages.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="row">
                <Field label="Owner">
                  <ColorSelect
                    value={form.ownerId}
                    onChange={(v) => set("ownerId", v)}
                    placeholder="Unassigned"
                    options={meta.owners.map((o) => ({ value: o.id, label: o.name, color: o.color }))}
                  />
                </Field>
                <Field label="Sales Team">
                  <ColorSelect
                    value={form.technicalMemberId}
                    onChange={(v) => set("technicalMemberId", v)}
                    placeholder="Unassigned"
                    options={meta.technicalMembers.map((m) => ({ value: m.id, label: m.name, color: m.color }))}
                  />
                </Field>
              </div>
              <div className="row">
                <Field label="Primary contact">
                  <select
                    className="select"
                    value={form.primaryContactId}
                    onChange={(e) => set("primaryContactId", e.target.value)}
                  >
                    <option value="">None</option>
                    {meta.contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Expected close date">
                  <input
                    className="input"
                    type="date"
                    value={form.expectedCloseDate}
                    onChange={(e) => set("expectedCloseDate", e.target.value)}
                  />
                </Field>
              </div>
              <div className="row">
                <Field label="City">
                  <input className="input" value={form.city} onChange={(e) => set("city", e.target.value)} />
                </Field>
                <Field label="State / region">
                  <input className="input" value={form.state} onChange={(e) => set("state", e.target.value)} />
                </Field>
              </div>
              <div className="row">
                <Field label="Country">
                  <input className="input" value={form.country} onChange={(e) => set("country", e.target.value)} />
                </Field>
                <Field label="Postal code">
                  <input className="input" value={form.postalCode} onChange={(e) => set("postalCode", e.target.value)} />
                </Field>
              </div>
              <Field label="Notes">
                <textarea className="textarea" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
              </Field>
              <button className="btn primary" disabled={busy}>
                {busy ? "Saving…" : "Save changes"}
              </button>
            </form>
          ) : (
            <dl style={{ display: "grid", gridTemplateColumns: "130px 1fr", rowGap: 8, margin: 0 }}>
              <dt className="muted">Amount</dt>
              <dd style={{ margin: 0 }}>{money(deal.amount, deal.currency)}</dd>
              <dt className="muted">Stage</dt>
              <dd style={{ margin: 0 }}>
                {deal.stage.label}
                {deal.stage.isWon ? " ✅" : deal.stage.isLost ? " ❌" : ""}
              </dd>
              <dt className="muted">Account</dt>
              <dd style={{ margin: 0 }}>
                <Link href={`/accounts/${deal.account.id}`}>{deal.account.name}</Link>
              </dd>
              <dt className="muted">Primary contact</dt>
              <dd style={{ margin: 0 }}>
                {deal.primaryContact
                  ? `${deal.primaryContact.firstName} ${deal.primaryContact.lastName ?? ""}`.trim()
                  : "—"}
              </dd>
              <dt className="muted">Owner</dt>
              <dd style={{ margin: 0 }}>
                {deal.owner ? (
                  <ColorTag
                    label={deal.owner.name}
                    color={meta.owners.find((o) => o.id === deal.owner!.id)?.color}
                  />
                ) : (
                  "Unassigned"
                )}
              </dd>
              <dt className="muted">Sales Team</dt>
              <dd style={{ margin: 0 }}>
                {deal.technicalMember ? (
                  <ColorTag label={deal.technicalMember.name} color={deal.technicalMember.color} />
                ) : (
                  "Unassigned"
                )}
              </dd>
              <dt className="muted">Location</dt>
              <dd style={{ margin: 0 }}>
                {[deal.city, deal.state, deal.country].filter(Boolean).join(", ") || "—"}
                {deal.postalCode ? ` (${deal.postalCode})` : ""}
              </dd>
              <dt className="muted">Expected close</dt>
              <dd style={{ margin: 0 }}>{date(deal.expectedCloseDate)}</dd>
              <dt className="muted">Closed at</dt>
              <dd style={{ margin: 0 }}>{dateTime(deal.closedAt)}</dd>
              <dt className="muted">From lead</dt>
              <dd style={{ margin: 0 }}>
                {deal.sourceLead ? (
                  <Link href={`/leads/${deal.sourceLead.id}`}>
                    {deal.sourceLead.firstName} {deal.sourceLead.lastName ?? ""}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
              <dt className="muted">Notes</dt>
              <dd style={{ margin: 0 }}>{deal.notes ?? "—"}</dd>
            </dl>
          )}
        </div>

        <div className="card">
          <h2>Activity</h2>
          <div className="stack" style={{ gap: 10 }}>
            {audit.map((a) => (
              <div key={a.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
                <strong>{a.action.replace("DEAL_", "").replace(/_/g, " ").toLowerCase()}</strong>
                {a.field ? (
                  <span className="muted">
                    {" "}
                    — {a.field}: {a.oldValue ?? "∅"} → {a.newValue ?? "∅"}
                  </span>
                ) : null}
                <br />
                <span className="hint">
                  {a.user?.name ?? a.actorLabel} · {dateTime(a.createdAt)}
                </span>
              </div>
            ))}
            {audit.length === 0 ? <p className="muted">No history yet.</p> : null}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <h2>Associated Contacts</h2>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Email</th>
                <th>Phone</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {deal.associatedContacts.map((a) => (
                <tr key={a.id}>
                  <td>
                    <Link href={`/accounts/${deal.account.id}`}>
                      {a.contact.firstName} {a.contact.lastName ?? ""}
                    </Link>
                    {a.isPrimary ? <span className="pill" style={{ marginLeft: 6 }}>primary</span> : null}
                  </td>
                  <td>{a.role ?? "—"}</td>
                  <td>{a.contact.email ?? "—"}</td>
                  <td>{a.contact.phone ?? "—"}</td>
                  <td>
                    <button className="btn sm" onClick={() => removeContact(a.contact.id)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {deal.associatedContacts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted">
                    No contacts linked to this opportunity yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {addableContacts.length > 0 ? (
          <div className="row" style={{ marginTop: 12, alignItems: "flex-end" }}>
            <Field label="Add a contact from this account">
              <select
                className="select"
                value={addContactId}
                onChange={(e) => setAddContactId(e.target.value)}
              >
                <option value="">Select…</option>
                {addableContacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Role (optional)">
              <input
                className="input"
                placeholder="Buyer, Co-applicant, Agent…"
                value={addRole}
                onChange={(e) => setAddRole(e.target.value)}
              />
            </Field>
            <button type="button" className="btn primary" onClick={addContact} disabled={!addContactId}>
              Link contact
            </button>
          </div>
        ) : null}
      </div>

      {toast ? <Toast message={toast.msg} kind={toast.kind} onDone={() => setToast(null)} /> : null}
    </>
  );
}
