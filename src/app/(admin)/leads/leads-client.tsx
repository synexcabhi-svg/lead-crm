"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/client";
import { useRealtime } from "@/hooks/useRealtime";
import { StatusBadge, PriorityPill } from "@/components/StatusBadge";
import { ColorSelect, ColorTag } from "@/components/ColorSelect";
import { Toast } from "@/components/ui";
import type { LeadListQuery } from "@/domain/leads/lead.schema";
import type { listLeads } from "@/domain/leads/lead.service";

type ListResult = Awaited<ReturnType<typeof listLeads>>;
interface Meta {
  statuses: { key: string; label: string }[];
  sources: { key: string; label: string; color?: string }[];
  owners: { id: string; name: string; color?: string }[];
  technicalMembers: { id: string; name: string; color?: string }[];
}
interface Perms {
  reassignOwner: boolean;
  hardDeleteLead: boolean;
}

export function LeadsClient({
  initial,
  query,
  meta,
  perms,
}: {
  initial: ListResult;
  query: LeadListQuery;
  meta: Meta;
  perms: Perms;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [data, setData] = useState(initial);
  const [q, setQ] = useState(query.q ?? "");
  const [toast, setToast] = useState<{ msg: string; kind: "info" | "error" } | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => setData(initial), [initial]);

  const reload = useCallback(async () => {
    const res = await api<ListResult>(`/api/leads?${sp.toString()}`);
    setData(res);
  }, [sp]);

  useRealtime(reload);

  function pushQuery(patch: Record<string, string | number | undefined>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === "" || v === "all") next.delete(k);
      else next.set(k, String(v));
    }
    if (!("page" in patch)) next.set("page", "1");
    startTransition(() => router.push(`/leads?${next.toString()}`));
  }

  function toggleSort(field: string) {
    const dir = query.sortBy === field && query.sortDir === "desc" ? "asc" : "desc";
    pushQuery({ sortBy: field, sortDir: dir });
  }

  async function quickPatch(id: string, body: Record<string, unknown>, label: string) {
    try {
      await api(`/api/leads/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      setToast({ msg: label, kind: "info" });
      reload();
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : "Update failed", kind: "error" });
    }
  }

  async function archive(id: string) {
    if (!confirm("Archive this lead?")) return;
    try {
      await api(`/api/leads/${id}`, { method: "DELETE" });
      setToast({ msg: "Lead archived", kind: "info" });
      reload();
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : "Archive failed", kind: "error" });
    }
  }

  const { items, page, totalPages, total } = data;
  const sortMark = (f: string) => (query.sortBy === f ? (query.sortDir === "desc" ? " ▼" : " ▲") : "");

  return (
    <>
      <div className="topbar">
        <h1>Leads <span className="muted" style={{ fontWeight: 400 }}>({total})</span></h1>
        <div className="row" style={{ flex: "unset", gap: 8 }}>
          <a className="btn sm" href={`/api/leads/export?${sp.toString()}`}>
            Export CSV
          </a>
          <Link className="btn primary sm" href="/leads/new">
            + Add Lead
          </Link>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              pushQuery({ q });
            }}
          >
            <input
              className="input"
              placeholder="Search name, email, phone, company"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </form>
          <select className="select" value={query.status ?? "all"} onChange={(e) => pushQuery({ status: e.target.value })}>
            <option value="all">All statuses</option>
            {meta.statuses.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <ColorSelect
            value={query.source ?? ""}
            onChange={(v) => pushQuery({ source: v })}
            placeholder="All sources"
            options={meta.sources.map((s) => ({ value: s.key, label: s.label, color: s.color }))}
          />
          <ColorSelect
            value={query.owner ?? ""}
            onChange={(v) => pushQuery({ owner: v })}
            placeholder="All owners"
            options={[
              { value: "unassigned", label: "Unassigned" },
              ...meta.owners.map((o) => ({ value: o.id, label: o.name, color: o.color })),
            ]}
          />
          <ColorSelect
            value={query.tech && query.tech !== "unassigned" ? query.tech : query.tech === "unassigned" ? "unassigned" : ""}
            onChange={(v) => pushQuery({ tech: v })}
            placeholder="All Sales Team"
            options={[
              { value: "unassigned", label: "Unassigned" },
              ...meta.technicalMembers.map((m) => ({ value: m.id, label: m.name, color: m.color })),
            ]}
          />
          <select className="select" value={query.archived} onChange={(e) => pushQuery({ archived: e.target.value })}>
            <option value="false">Active</option>
            <option value="true">Archived</option>
            <option value="all">All</option>
          </select>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              pushQuery({ state: (e.currentTarget.elements.namedItem("state") as HTMLInputElement).value });
            }}
          >
            <input name="state" className="input" placeholder="State / region" defaultValue={query.state ?? ""} />
          </form>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th onClick={() => toggleSort("firstName")}>Name{sortMark("firstName")}</th>
              <th>Email</th>
              <th>Phone</th>
              <th onClick={() => toggleSort("company")}>Company{sortMark("company")}</th>
              <th>Location</th>
              <th>Source</th>
              <th onClick={() => toggleSort("statusKey")}>Status{sortMark("statusKey")}</th>
              <th onClick={() => toggleSort("priority")}>Priority{sortMark("priority")}</th>
              <th>Owner</th>
              <th>Sales Team</th>
              <th onClick={() => toggleSort("createdAt")}>Created{sortMark("createdAt")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((l) => (
              <tr key={l.id}>
                <td>
                  <Link href={`/leads/${l.id}`}>
                    {l.firstName} {l.lastName ?? ""}
                  </Link>
                  {l.isDuplicate ? <span className="pill" style={{ marginLeft: 6 }}>dup</span> : null}
                </td>
                <td>{l.email ?? "-"}</td>
                <td>{l.phone ?? "-"}</td>
                <td>{l.company ?? "-"}</td>
                <td>{[l.city, l.state].filter(Boolean).join(", ") || "-"}</td>
                <td>
                  <ColorTag label={l.source.label} color={l.source.color} />
                </td>
                <td>
                  <select
                    className="select"
                    style={{ padding: "3px 6px", fontSize: "0.78rem" }}
                    value={l.statusKey}
                    onChange={(e) => quickPatch(l.id, { statusKey: e.target.value }, "Status updated")}
                  >
                    {meta.statuses.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <PriorityPill value={l.priority} />
                </td>
                <td style={{ minWidth: 150 }}>
                  {perms.reassignOwner ? (
                    <ColorSelect
                      compact
                      value={l.ownerId ?? ""}
                      onChange={(v) => quickPatch(l.id, { ownerId: v }, "Owner updated")}
                      placeholder="Unassigned"
                      options={meta.owners.map((o) => ({ value: o.id, label: o.name, color: o.color }))}
                    />
                  ) : l.owner ? (
                    <ColorTag label={l.owner.name} color={meta.owners.find((o) => o.id === l.owner!.id)?.color} />
                  ) : (
                    <span className="muted">Unassigned</span>
                  )}
                </td>
                <td style={{ minWidth: 150 }}>
                  <ColorSelect
                    compact
                    value={l.technicalMemberId ?? ""}
                    onChange={(v) => quickPatch(l.id, { technicalMemberId: v }, "Sales Team assigned")}
                    placeholder="Unassigned"
                    options={meta.technicalMembers.map((m) => ({ value: m.id, label: m.name, color: m.color }))}
                  />
                </td>
                <td>{new Date(l.createdAt).toLocaleDateString()}</td>
                <td>
                  {!l.isArchived ? (
                    <button className="btn sm" onClick={() => archive(l.id)}>
                      Archive
                    </button>
                  ) : (
                    <span className="muted">archived</span>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={12} className="muted">
                  No leads match these filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <button className="btn sm" disabled={page <= 1} onClick={() => pushQuery({ page: page - 1 })}>
          Prev
        </button>
        <span className="muted">
          Page {page} / {totalPages}
        </span>
        <button className="btn sm" disabled={page >= totalPages} onClick={() => pushQuery({ page: page + 1 })}>
          Next
        </button>
        <select
          className="select"
          style={{ width: "auto" }}
          value={query.pageSize}
          onChange={(e) => pushQuery({ pageSize: e.target.value, page: 1 })}
        >
          {[20, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n} / page
            </option>
          ))}
        </select>
      </div>

      {toast ? <Toast message={toast.msg} kind={toast.kind} onDone={() => setToast(null)} /> : null}
    </>
  );
}
