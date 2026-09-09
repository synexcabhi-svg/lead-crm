"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/lib/client";
import { Field, Toast } from "@/components/ui";
import { ColorSelect } from "@/components/ColorSelect";

interface Territory {
  id: string;
  country: string | null;
  state: string | null;
  city: string | null;
  sortOrder: number;
  technicalMember: { id: string; name: string; isActive: boolean };
}

export function TerritoriesClient({
  initial,
  members,
}: {
  initial: Territory[];
  members: { id: string; name: string; color?: string }[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [form, setForm] = useState({ technicalMemberId: members[0]?.id ?? "", country: "", state: "", city: "", sortOrder: "0" });
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: "info" | "error" } | null>(null);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function refresh() {
    setRows(await api<Territory[]>("/api/territories"));
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.country && !form.state && !form.city) {
      setToast({ msg: "Enter at least a city, state or country", kind: "error" });
      return;
    }
    setBusy(true);
    try {
      await api("/api/territories", {
        method: "POST",
        body: JSON.stringify({
          technicalMemberId: form.technicalMemberId,
          country: form.country,
          state: form.state,
          city: form.city,
          sortOrder: Number(form.sortOrder) || 0,
        }),
      });
      setForm((f) => ({ ...f, country: "", state: "", city: "" }));
      await refresh();
      router.refresh();
      setToast({ msg: "Territory added", kind: "info" });
    } catch (e2) {
      setToast({ msg: e2 instanceof ApiClientError ? e2.message : "Failed", kind: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this territory rule?")) return;
    try {
      await api(`/api/territories/${id}`, { method: "DELETE" });
      await refresh();
      router.refresh();
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : "Failed", kind: "error" });
    }
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h1 style={{ marginBottom: 2 }}>Territories</h1>
          <span className="muted">
            A lead is auto-assigned to a Sales Team member when its location matches a rule. Most
            specific rule wins (city &gt; state &gt; country).
          </span>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <h2>Add a rule</h2>
        <form onSubmit={add}>
          <div className="row">
            <Field label="Sales Team member">
              <ColorSelect
                value={form.technicalMemberId}
                onChange={(v) => set("technicalMemberId", v)}
                options={members.map((m) => ({ value: m.id, label: m.name, color: m.color }))}
              />
            </Field>
            <Field label="Priority (tie-break, lower first)">
              <input
                className="input"
                inputMode="numeric"
                value={form.sortOrder}
                onChange={(e) => set("sortOrder", e.target.value.replace(/[^\d]/g, ""))}
              />
            </Field>
          </div>
          <div className="row">
            <Field label="City" hint="leave blank to match the whole state">
              <input className="input" value={form.city} onChange={(e) => set("city", e.target.value)} />
            </Field>
            <Field label="State / region">
              <input className="input" value={form.state} onChange={(e) => set("state", e.target.value)} />
            </Field>
            <Field label="Country">
              <input className="input" value={form.country} onChange={(e) => set("country", e.target.value)} />
            </Field>
          </div>
          <button className="btn primary" disabled={busy}>
            {busy ? "Adding…" : "Add rule"}
          </button>
        </form>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Sales Team member</th>
              <th>City</th>
              <th>State / region</th>
              <th>Country</th>
              <th>Priority</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id}>
                <td>
                  {t.technicalMember.name}
                  {!t.technicalMember.isActive ? <span className="pill" style={{ marginLeft: 6 }}>inactive</span> : null}
                </td>
                <td>{t.city ?? "—"}</td>
                <td>{t.state ?? "—"}</td>
                <td>{t.country ?? "—"}</td>
                <td>{t.sortOrder}</td>
                <td>
                  <button className="btn sm danger" onClick={() => remove(t.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted">
                  No territory rules yet. Leads won&apos;t be auto-assigned by location until you add some.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {toast ? <Toast message={toast.msg} kind={toast.kind} onDone={() => setToast(null)} /> : null}
    </>
  );
}
