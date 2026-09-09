"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { useRealtime } from "@/hooks/useRealtime";
import { BarList } from "@/components/BarList";
import { StatusBadge } from "@/components/StatusBadge";
import { money } from "@/lib/format";

type Everything = Awaited<ReturnType<typeof import("@/domain/dashboard/dashboard.service").getEverything>>;

function Kpi({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="card kpi">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub ? <div className="sub">{sub}</div> : null}
    </div>
  );
}

export function DashboardClient({ initial }: { initial: Everything }) {
  const [data, setData] = useState<Everything>(initial);

  const reload = useCallback(async () => {
    const [summary, bySource, byOwner, byTechnicalMember, recent, conversion, pipeline] = await Promise.all([
      api<Everything["summary"]>("/api/dashboard/summary"),
      api<Everything["bySource"]>("/api/dashboard/leads-by-source"),
      api<Everything["byOwner"]>("/api/dashboard/leads-by-owner"),
      api<Everything["byTechnicalMember"]>("/api/dashboard/leads-by-technical-member"),
      api<Everything["recent"]>("/api/dashboard/recent-leads?limit=8"),
      api<Everything["conversion"]>("/api/dashboard/conversion"),
      api<Everything["pipeline"]>("/api/dashboard/pipeline"),
    ]);
    setData({ summary, bySource, byOwner, byTechnicalMember, recent, conversion, pipeline });
  }, []);

  const { status } = useRealtime(reload);
  const { summary, bySource, byOwner, byTechnicalMember, recent, conversion, pipeline } = data;

  return (
    <>
      <div className="topbar">
        <h1>Dashboard</h1>
        <span className="hint">
          <span className={`live-dot ${status === "live" ? "" : "stale"}`} />
          {status === "live" ? "Live" : status === "polling" ? "Auto-refresh" : "Connecting"}
          {" · "}
          {new Date(summary.generatedAt).toLocaleTimeString()}
        </span>
      </div>

      <div className="grid kpi-grid">
        <Kpi label="Total leads" value={summary.total} />
        <Kpi label="Open" value={summary.open} />
        <Kpi label="Converted" value={summary.converted} sub={`${summary.conversionRate}% conversion`} />
        <Kpi label="Lost" value={summary.lost} />
        <Kpi label="Today" value={summary.createdToday} />
        <Kpi label="This week" value={summary.createdThisWeek} />
        <Kpi label="This month" value={summary.createdThisMonth} />
      </div>

      <div className="grid cols-2" style={{ marginTop: 14 }}>
        <div className="card">
          <h2>Leads by status</h2>
          <BarList
            items={summary.byStatus.map((s) => ({ label: s.label, count: s.count, color: s.color }))}
          />
        </div>
        <div className="card">
          <h2>Leads by source</h2>
          <BarList items={bySource.map((s) => ({ label: s.label, count: s.count, color: s.color }))} />
        </div>
        <div className="card">
          <h2>Leads by owner</h2>
          <BarList items={byOwner.map((o) => ({ label: o.name, count: o.count }))} />
        </div>
        <div className="card">
          <h2>Leads by Sales Team</h2>
          <BarList
            items={[
              ...byTechnicalMember.members.map((m) => ({ label: m.name, count: m.count, color: m.color })),
              ...(byTechnicalMember.unassigned
                ? [{ label: "Unassigned", count: byTechnicalMember.unassigned }]
                : []),
            ]}
            empty="No leads assigned to the Sales Team yet"
          />
        </div>
        <div className="card">
          <h2>Conversion (6 months)</h2>
          <BarList
            items={conversion.byMonth.map((m) => ({
              label: `${m.month} (${m.converted}/${m.created})`,
              count: m.created,
            }))}
          />
        </div>
        <div className="card">
          <h2>Deal pipeline</h2>
          <p className="sub" style={{ marginTop: -4 }}>
            Open {money(pipeline.openValue)} · Won {money(pipeline.wonValue)} · Win rate {pipeline.winRate}%
          </p>
          <BarList
            items={pipeline.perStage.map((s) => ({ label: `${s.label} (${s.count})`, count: s.amount }))}
            empty="No deals yet"
          />
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <h2>Recent leads</h2>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th>Source</th>
                <th>Status</th>
                <th>Owner</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((l) => (
                <tr key={l.id}>
                  <td>
                    <Link href={`/leads/${l.id}`}>
                      {l.firstName} {l.lastName ?? ""}
                    </Link>
                  </td>
                  <td>{l.source.label}</td>
                  <td>
                    <StatusBadge label={l.status.label} color={l.status.color} />
                  </td>
                  <td>{l.owner?.name ?? "-"}</td>
                  <td>{new Date(l.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {recent.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted">
                    No leads yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
