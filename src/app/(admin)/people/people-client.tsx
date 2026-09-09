"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError, fieldErrors } from "@/lib/client";
import { Field, Toast } from "@/components/ui";

const ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES"] as const;
const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  MANAGER: "Manager",
  SALES: "Sales",
};

interface Person {
  id: string;
  name: string;
  email: string;
  role: string;
  color: string;
  isActive: boolean;
  mustChangePassword: boolean;
}

export function PeopleClient({ initial, meId }: { initial: Person[]; meId: string }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [toast, setToast] = useState<{ msg: string; kind: "info" | "error" } | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: "SALES", color: "#2563eb", tempPassword: "Welcome@123" });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const setF = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function refresh() {
    setRows(await api<Person[]>("/api/users"));
    router.refresh();
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErrs({});
    setBusy(true);
    try {
      await api("/api/users", { method: "POST", body: JSON.stringify(form) });
      setForm({ name: "", email: "", role: "SALES", color: "#2563eb", tempPassword: "Welcome@123" });
      setCreating(false);
      await refresh();
      setToast({ msg: "Person added", kind: "info" });
    } catch (e2) {
      if (e2 instanceof ApiClientError) {
        setToast({ msg: e2.message, kind: "error" });
        setErrs(fieldErrors(e2.details));
      } else setToast({ msg: "Failed", kind: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, body: Record<string, unknown>, label: string) {
    try {
      await api(`/api/users/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      await refresh();
      setToast({ msg: label, kind: "info" });
    } catch (e) {
      setToast({ msg: e instanceof ApiClientError ? e.message : "Failed", kind: "error" });
    }
  }

  async function resetPw(id: string, name: string) {
    const pw = prompt(`Temporary password for ${name} (they'll be forced to change it):`, "Welcome@123");
    if (!pw) return;
    await patch(id, { resetPassword: pw }, "Password reset");
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h1 style={{ marginBottom: 2 }}>People &amp; Roles</h1>
          <span className="muted">
            This list is the Owner and Sales Team pickers. Roles: Super Admin &gt; Admin &gt; Manager &gt; Sales.
          </span>
        </div>
        <button className="btn primary sm" onClick={() => setCreating((v) => !v)}>
          {creating ? "Cancel" : "+ Add Person"}
        </button>
      </div>

      {creating ? (
        <div className="card" style={{ marginBottom: 14, maxWidth: 640 }}>
          <form onSubmit={create}>
            <div className="row">
              <Field label="Name" error={errs.name}>
                <input className="input" value={form.name} onChange={(e) => setF("name", e.target.value)} required />
              </Field>
              <Field label="Email" error={errs.email}>
                <input className="input" type="email" value={form.email} onChange={(e) => setF("email", e.target.value)} required />
              </Field>
            </div>
            <div className="row">
              <Field label="Role">
                <select className="select" value={form.role} onChange={(e) => setF("role", e.target.value)}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Colour">
                <input className="input" type="color" value={form.color} onChange={(e) => setF("color", e.target.value)} />
              </Field>
              <Field label="Temp password" error={errs.tempPassword}>
                <input className="input" value={form.tempPassword} onChange={(e) => setF("tempPassword", e.target.value)} />
              </Field>
            </div>
            <button className="btn primary" disabled={busy}>
              {busy ? "Adding…" : "Add person"}
            </button>
          </form>
        </div>
      ) : null}

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Colour</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>
                  {p.name}
                  {p.id === meId ? <span className="pill" style={{ marginLeft: 6 }}>you</span> : null}
                  {p.mustChangePassword ? <span className="pill" style={{ marginLeft: 6 }}>pw pending</span> : null}
                </td>
                <td>{p.email}</td>
                <td>
                  <select
                    className="select"
                    style={{ padding: "3px 6px", fontSize: "0.78rem" }}
                    value={p.role}
                    disabled={p.id === meId}
                    onChange={(e) => patch(p.id, { role: e.target.value }, "Role updated")}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    type="color"
                    value={p.color}
                    onChange={(e) => patch(p.id, { color: e.target.value }, "Colour updated")}
                    style={{ width: 40, height: 24, padding: 0, border: "1px solid var(--border)" }}
                  />
                </td>
                <td>
                  <button
                    className="btn sm"
                    disabled={p.id === meId}
                    onClick={() => patch(p.id, { isActive: !p.isActive }, p.isActive ? "Deactivated" : "Activated")}
                  >
                    {p.isActive ? "Active" : "Inactive"}
                  </button>
                </td>
                <td>
                  <button className="btn sm" onClick={() => resetPw(p.id, p.name)}>
                    Reset password
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {toast ? <Toast message={toast.msg} kind={toast.kind} onDone={() => setToast(null)} /> : null}
    </>
  );
}
