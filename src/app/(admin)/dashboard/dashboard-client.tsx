"use client";

import { useCallback, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { useRealtime } from "@/hooks/useRealtime";
import { BarList } from "@/components/BarList";
import { StatusBadge } from "@/components/StatusBadge";
import { money, relativeTime } from "@/lib/format";

type Everything = Awaited<ReturnType<typeof import("@/domain/dashboard/dashboard.service").getEverything>>;

function Kpi({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: number | string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div
      className="card kpi"
      style={accent ? ({ "--kpi-accent": accent } as CSSProperties) : undefined}
    >
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub ? <div className="sub">{sub}</div> : null}
    </div>
  );
}

function sum(items: { count: number }[]) {
  return items.reduce((s, i) => s + i.count, 0);
}

function ChartCard({
  title,
  total,
  children,
}: {
  title: string;
  total?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card">
      <div className="card-head">
        <h2>{title}</h2>
        {total ? <span className="total">{total}</span> : null}
      </div>
      {children}
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

  const ownerLeads = sum(byOwner.map((o) => ({ count: o.count })));
  const teamLeads =
    sum(byTechnicalMember.members.map((m) => ({ count: m.count }))) + (byTechnicalMember.unassigned ?? 0);

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

      <div className="dash-section">Pipeline health</div>
      <div className="grid kpi-grid">
        <Kpi label="Total leads" value={summary.total} accent="var(--primary)" />
        <Kpi label="Open" value={summary.open} accent="#d97706" />
        <Kpi
          label="Converted"
          value={summary.converted}
          sub={`${summary.conversionRate}% conversion`}
          accent="var(--success)"
        />
        <Kpi label="Lost" value={summary.lost} accent="var(--danger)" />
      </div>

      <div className="dash-section">New leads</div>
      <div className="grid kpi-grid">
        <Kpi label="Today" value={summary.createdToday} />
        <Kpi label="This week" value={summary.createdThisWeek} />
        <Kpi label="This month" value={summary.createdThisMonth} />
      </div>

      <div className="grid cols-2" style={{ marginTop: 18 }}>
        <ChartCard title="Leads by status" total={`${sum(summary.byStatus)} leads`}>
          <BarList
            items={summary.byStatus.map((s) => ({ label: s.label, count: s.count, color: s.color }))}
          />
        </ChartCard>
        <ChartCard title="Leads by source" total={`${sum(bySource)} leads`}>
          <BarList items={bySource.map((s) => ({ label: s.label, count: s.count, color: s.color }))} />
        </ChartCard>
        <ChartCard title="Leads by owner" total={`${ownerLeads} leads`}>
          <BarList items={byOwner.map((o) => ({ label: o.name, count: o.count }))} />
        </ChartCard>
        <ChartCard title="Leads by Sales Team" total={`${teamLeads} leads`}>
          <BarList
            items={[
              ...byTechnicalMember.members.map((m) => ({ label: m.name, count: m.count, color: m.color })),
              ...(byTechnicalMember.unassigned
                ? [{ label: "Unassigned", count: byTechnicalMember.unassigned }]
                : []),
            ]}
            empty="No leads assigned to the Sales Team yet"
          />
        </ChartCard>
        <ChartCard title="Conversion (6 months)">
          <BarList
            items={conversion.byMonth.map((m) => ({
              label: `${m.month} (${m.converted}/${m.created})`,
              count: m.created,
            }))}
          />
        </ChartCard>
        <ChartCard
          title="Opportunity pipeline"
          total={`Win rate ${pipeline.winRate}%`}
        >
          <p className="sub" style={{ marginTop: -4 }}>
            Open {money(pipeline.openValue)} · Won {money(pipeline.wonValue)}
          </p>
          <BarList
            items={pipeline.perStage.map((s) => ({ label: `${s.label} (${s.count})`, count: s.amount }))}
            empty="No opportunities yet"
          />
        </ChartCard>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-head">
          <h2>Recent leads</h2>
          <Link className="total" href="/leads">
            View all →
          </Link>
        </div>
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
                  <td>{l.owner?.name ?? "—"}</td>
                  <td title={new Date(l.createdAt).toLocaleString()}>{relativeTime(l.createdAt)}</td>
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
