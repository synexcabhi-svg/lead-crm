"use client";

/**
 * The "Calls" related list on a lead - log / edit / delete phone calls that
 * are stored against the lead (Zoho-style Calls module).
 */
import { useCallback, useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/client";
import { Field, Toast } from "@/components/ui";
import { dateTime } from "@/lib/format";
import {
  CALL_TYPES,
  CALL_TYPE_LABELS,
  CALL_PURPOSES,
  CALL_OUTCOMES,
} from "@/domain/calls/call.schema";

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

function nowLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
const blank = () => ({
  subject: "",
  callType: "outbound",
  purpose: "",
  outcome: "",
  callTime: nowLocal(),
  durationMinutes: "",
  notes: "",
});

export function CallsPanel({ leadId, initial }: { leadId: string; initial: CallDto[] }) {
  const [calls, setCalls] = useState<CallDto[]>(initial);
  const [form, setForm] = useState(blank());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: "info" | "error" } | null>(null);
  const set = (k: keyof ReturnType<typeof blank>, v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => setCalls(initial), [initial]);

  const reload = useCallback(async () => {
    setCalls(await api<CallDto[]>(`/api/leads/${leadId}/calls`));
  }, [leadId]);

  function startEdit(c: CallDto) {
    setEditingId(c.id);
    setOpen(true);
    setForm({
      subject: c.subject,
      callType: c.callType,
      purpose: c.purpose ?? "",
      outcome: c.outcome ?? "",
      callTime: c.callTime ? new Date(c.callTime).toISOString().slice(0, 16) : nowLocal(),
      durationMinutes: c.durationMinutes == null ? "" : String(c.durationMinutes),
      notes: c.notes ?? "",
    });
  }
  function cancel() {
    setEditingId(null);
    setOpen(false);
    setForm(blank());
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const body = {
        subject: form.subject,
        callType: form.callType,
        purpose: form.purpose || undefined,
        outcome: form.outcome || undefined,
        callTime: form.callTime || undefined,
        durationMinutes: form.durationMinutes === "" ? undefined : Number(form.durationMinutes),
        notes: form.notes || undefined,
      };
      if (editingId) {
        await api(`/api/calls/${editingId}`, { method: "PATCH", body: JSON.stringify(body) });
        setToast({ msg: "Call updated", kind: "info" });
      } else {
        await api(`/api/leads/${leadId}/calls`, { method: "POST", body: JSON.stringify(body) });
        setToast({ msg: "Call logged", kind: "info" });
      }
      cancel();
      await reload();
    } catch (e2) {
      setToast({ msg: e2 instanceof ApiClientError ? e2.message : "Failed", kind: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this call log?")) return;
    try {
      await api(`/api/calls/${id}`, { method: "DELETE" });
      await reload();
    } catch (e) {
      setToast({ msg: e instanceof ApiClientError ? e.message : "Failed", kind: "error" });
    }
  }

  return (
    <div className="card" style={{ marginTop: 14 }}>
      <div className="topbar" style={{ marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>
          Calls <span className="muted" style={{ fontWeight: 400 }}>({calls.length})</span>
        </h2>
        {!open ? (
          <button className="btn primary sm" onClick={() => setOpen(true)}>
            + Log a Call
          </button>
        ) : null}
      </div>

      {open ? (
        <form onSubmit={save} noValidate style={{ marginBottom: 14 }}>
          <div className="row">
            <Field label="Subject">
              <input className="input" value={form.subject} onChange={(e) => set("subject", e.target.value)} required />
            </Field>
            <Field label="Type">
              <select className="select" value={form.callType} onChange={(e) => set("callType", e.target.value)}>
                {CALL_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {CALL_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="row">
            <Field label="Purpose">
              <select className="select" value={form.purpose} onChange={(e) => set("purpose", e.target.value)}>
                <option value="">—</option>
                {CALL_PURPOSES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Outcome">
              <select className="select" value={form.outcome} onChange={(e) => set("outcome", e.target.value)}>
                <option value="">—</option>
                {CALL_OUTCOMES.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="row">
            <Field label="When">
              <input
                className="input"
                type="datetime-local"
                value={form.callTime}
                onChange={(e) => set("callTime", e.target.value)}
              />
            </Field>
            <Field label="Duration (min)">
              <input
                className="input"
                inputMode="numeric"
                value={form.durationMinutes}
                onChange={(e) => set("durationMinutes", e.target.value.replace(/[^\d]/g, ""))}
              />
            </Field>
          </div>
          <Field label="Notes">
            <textarea className="textarea" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
          <div className="row" style={{ flex: "unset", gap: 8 }}>
            <button className="btn primary" disabled={busy}>
              {busy ? "Saving…" : editingId ? "Save call" : "Log call"}
            </button>
            <button type="button" className="btn" onClick={cancel} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Subject</th>
              <th>Type</th>
              <th>Purpose</th>
              <th>Outcome</th>
              <th>When</th>
              <th>Min</th>
              <th>Logged by</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {calls.map((c) => (
              <tr key={c.id}>
                <td className="wrap">
                  {c.subject}
                  {c.notes ? <div className="hint">{c.notes}</div> : null}
                </td>
                <td>{CALL_TYPE_LABELS[c.callType] ?? c.callType}</td>
                <td>{c.purpose ?? "—"}</td>
                <td>{c.outcome ?? "—"}</td>
                <td>{dateTime(c.callTime)}</td>
                <td>{c.durationMinutes ?? "—"}</td>
                <td>{c.owner?.name ?? "—"}</td>
                <td>
                  <button className="btn sm" onClick={() => startEdit(c)}>
                    Edit
                  </button>{" "}
                  <button className="btn sm" onClick={() => remove(c.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {calls.length === 0 ? (
              <tr>
                <td colSpan={8} className="muted">
                  No calls logged for this lead yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {toast ? <Toast message={toast.msg} kind={toast.kind} onDone={() => setToast(null)} /> : null}
    </div>
  );
}
