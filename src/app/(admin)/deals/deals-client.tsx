"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/client";
import { useRealtime } from "@/hooks/useRealtime";
import { Toast } from "@/components/ui";
import { ColorSelect, ColorTag } from "@/components/ColorSelect";
import { money, date } from "@/lib/format";
import type { DealListQuery } from "@/domain/deals/deal.schema";
import type { listDeals } from "@/domain/deals/deal.service";

type ListResult = Awaited<ReturnType<typeof listDeals>>;
interface Meta {
  stages: { key: string; label: string }[];
  owners: { id: string; name: string; color?: string }[];
  technicalMembers: { id: string; name: string; color?: string }[];
  accounts: { id: string; name: string }[];
}

export function DealsClient({
  initial,
  query,
  meta,
}: {
  initial: ListResult;
  query: DealListQuery;
  meta: Meta;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [data, setData] = useState(initial);
  const [q, setQ] = useState(query.q ?? "");
  const [toast, setToast] = useState<{ msg: string; kind: "info" | "error" } | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => setData(initial), [initial]);
  const reload = useCallback(async () => {
    setData(await api<ListResult>(`/api/deals?${sp.toString()}`));
  }, [sp]);
  useRealtime(reload);

  function pushQuery(patch: Record<string, string | number | undefined>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === "" || v === "all") next.delete(k);
      else next.set(k, String(v));
    }
    if (!("page" in patch)) next.set("page", "1");
    startTransition(() => router.push(`/deals?${next.toString()}`));
  }

  async function quickPatch(id: string, body: Record<string, unknown>, label: string) {
    try {
      await api(`/api/deals/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      setToast({ msg: label, kind: "info" });
      reload();
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : "Update failed", kind: "error" });
    }
  }

  const { items, page, totalPages, total, totalAmount } = data;

  return (
    <>
      <div className="topbar">
        <h1>
          Deals <span className="muted" style={{ fontWeight: 400 }}>({total} · {money(totalAmount)})</span>
        </h1>
        <Link className="btn primary sm" href="/deals/new">
          + New Deal
        </Link>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              pushQuery({ q });
            }}
          >
            <input className="input" placeholder="Search deal or account" value={q} onChange={(e) => setQ(e.target.value)} />
          </form>
          <select className="select" value={query.stage ?? "all"} onChange={(e) => pushQuery({ stage: e.target.value })}>
            <option value="all">All stages</option>
            {meta.stages.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <select className="select" value={query.account ?? "all"} onChange={(e) => pushQuery({ account: e.target.value })}>
            <option value="all">All accounts</option>
            {meta.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
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
            value={query.tech ?? ""}
            onChange={(v) => pushQuery({ tech: v })}
            placeholder="All Sales Team"
            options={[
              { value: "unassigned", label: "Unassigned" },
              ...meta.technicalMembers.map((m) => ({ value: m.id, label: m.name, color: m.color })),
            ]}
          />
          <select className="select" value={query.open} onChange={(e) => pushQuery({ open: e.target.value })}>
            <option value="all">All</option>
            <option value="true">Open only</option>
            <option value="false">Closed only</option>
          </select>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Deal</th>
              <th>Account</th>
              <th>Amount</th>
              <th>Stage</th>
              <th>Owner</th>
              <th>Sales Team</th>
              <th>Close date</th>
              <th>From lead</th>
            </tr>
          </thead>
          <tbody>
            {items.map((d) => (
              <tr key={d.id}>
                <td>
                  <Link href={`/deals/${d.id}`}>{d.name}</Link>
                </td>
                <td>
                  <Link href={`/accounts/${d.account.id}`}>{d.account.name}</Link>
                </td>
                <td>{money(d.amount, d.currency)}</td>
                <td>
                  <select
                    className="select"
                    style={{ padding: "3px 6px", fontSize: "0.78rem" }}
                    value={d.stageKey}
                    onChange={(e) => quickPatch(d.id, { stageKey: e.target.value }, "Stage updated")}
                  >
                    {meta.stages.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  {d.owner ? (
                    <ColorTag
                      label={d.owner.name}
                      color={meta.owners.find((o) => o.id === d.owner!.id)?.color}
                    />
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  {d.technicalMember ? (
                    <ColorTag label={d.technicalMember.name} color={d.technicalMember.color} />
                  ) : (
                    "—"
                  )}
                </td>
                <td>{date(d.expectedCloseDate)}</td>
                <td>
                  {d.sourceLead ? (
                    <Link href={`/leads/${d.sourceLead.id}`}>
                      {d.sourceLead.firstName} {d.sourceLead.lastName ?? ""}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} className="muted">
                  No deals match these filters.
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
      </div>

      {toast ? <Toast message={toast.msg} kind={toast.kind} onDone={() => setToast(null)} /> : null}
    </>
  );
}
