"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/lib/client";
import { Field, Toast } from "@/components/ui";

interface AccountRow {
  id: string;
  name: string;
  industry: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  owner: { name: string } | null;
  technicalMember: { name: string } | null;
  _count: { contacts: number; deals: number };
}
interface Result {
  items: AccountRow[];
  total: number;
  page: number;
  totalPages: number;
}

export function AccountsClient({ initial, q }: { initial: Result; q: string }) {
  const router = useRouter();
  const [search, setSearch] = useState(q);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: "info" | "error" } | null>(null);

  function go(params: Record<string, string | number | undefined>) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") sp.set(k, String(v));
    router.push(`/accounts?${sp.toString()}`);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api<{ account: { id: string } }>("/api/accounts", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      router.push(`/accounts/${res.account.id}`);
      router.refresh();
    } catch (e2) {
      setToast({ msg: e2 instanceof ApiClientError ? e2.message : "Failed", kind: "error" });
      setBusy(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <h1>
          Accounts <span className="muted" style={{ fontWeight: 400 }}>({initial.total})</span>
        </h1>
        <button className="btn primary sm" onClick={() => setCreating((v) => !v)}>
          {creating ? "Cancel" : "+ New Account"}
        </button>
      </div>

      {creating ? (
        <div className="card" style={{ marginBottom: 14, maxWidth: 420 }}>
          <form onSubmit={create}>
            <Field label="Account name">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <button className="btn primary" disabled={busy || !name.trim()}>
              {busy ? "Creating…" : "Create"}
            </button>
          </form>
        </div>
      ) : null}

      <div className="card" style={{ marginBottom: 14 }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            go({ q: search });
          }}
        >
          <input
            className="input"
            placeholder="Search accounts"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Name</th>
              <th>Location</th>
              <th>Phone</th>
              <th>Owner</th>
              <th>Sales Team</th>
              <th>Contacts</th>
              <th>Opportunities</th>
            </tr>
          </thead>
          <tbody>
            {initial.items.map((a) => (
              <tr key={a.id}>
                <td>
                  <Link href={`/accounts/${a.id}`}>{a.name}</Link>
                </td>
                <td>{[a.city, a.state].filter(Boolean).join(", ") || "—"}</td>
                <td>{a.phone ?? "—"}</td>
                <td>{a.owner?.name ?? "—"}</td>
                <td>{a.technicalMember?.name ?? "—"}</td>
                <td>{a._count.contacts}</td>
                <td>{a._count.deals}</td>
              </tr>
            ))}
            {initial.items.length === 0 ? (
              <tr>
                <td colSpan={7} className="muted">
                  No accounts yet. Convert a lead, or add one above.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <button className="btn sm" disabled={initial.page <= 1} onClick={() => go({ q, page: initial.page - 1 })}>
          Prev
        </button>
        <span className="muted">
          Page {initial.page} / {initial.totalPages}
        </span>
        <button
          className="btn sm"
          disabled={initial.page >= initial.totalPages}
          onClick={() => go({ q, page: initial.page + 1 })}
        >
          Next
        </button>
      </div>

      {toast ? <Toast message={toast.msg} kind={toast.kind} onDone={() => setToast(null)} /> : null}
    </>
  );
}
