import Link from "next/link";
import { notFound } from "next/navigation";
import { getAccount } from "@/domain/accounts/account.service";
import { StatusBadge } from "@/components/StatusBadge";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AccountDetailPage({ params }: { params: { id: string } }) {
  const account = await getAccount(params.id);
  if (!account) notFound();

  return (
    <>
      <div className="topbar">
        <div>
          <h1 style={{ marginBottom: 2 }}>{account.name}</h1>
          <span className="muted">
            <Link href="/accounts">Accounts</Link> / {account.id}
          </span>
        </div>
        <Link className="btn primary sm" href="/deals/new">
          + New Opportunity
        </Link>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h2>Details</h2>
          <dl style={{ display: "grid", gridTemplateColumns: "130px 1fr", rowGap: 8, margin: 0 }}>
            <dt className="muted">Industry</dt>
            <dd style={{ margin: 0 }}>{account.industry ?? "—"}</dd>
            <dt className="muted">Website</dt>
            <dd style={{ margin: 0 }}>{account.website ?? "—"}</dd>
            <dt className="muted">Phone</dt>
            <dd style={{ margin: 0 }}>{account.phone ?? "—"}</dd>
            <dt className="muted">Location</dt>
            <dd style={{ margin: 0 }}>
              {[account.city, account.state, account.country].filter(Boolean).join(", ") || "—"}
              {account.postalCode ? ` (${account.postalCode})` : ""}
            </dd>
            <dt className="muted">Owner</dt>
            <dd style={{ margin: 0 }}>{account.owner?.name ?? "Unassigned"}</dd>
            <dt className="muted">Sales Team</dt>
            <dd style={{ margin: 0 }}>
              {account.technicalMember ? (
                <StatusBadge label={account.technicalMember.name} color={account.technicalMember.color} />
              ) : (
                "Unassigned"
              )}
            </dd>
            <dt className="muted">Notes</dt>
            <dd style={{ margin: 0 }}>{account.notes ?? "—"}</dd>
          </dl>
        </div>

        <div className="card">
          <h2>Contacts ({account.contacts.length})</h2>
          <div className="stack" style={{ gap: 8 }}>
            {account.contacts.map((c) => (
              <div key={c.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
                <strong>
                  {c.firstName} {c.lastName ?? ""}
                </strong>
                {c.title ? <span className="muted"> · {c.title}</span> : null}
                <br />
                <span className="hint">
                  {c.email ?? "—"} · {c.phone ?? "—"}
                  {[c.city, c.state].filter(Boolean).length
                    ? ` · ${[c.city, c.state].filter(Boolean).join(", ")}`
                    : ""}
                  {c.technicalMember ? ` · sales: ${c.technicalMember.name}` : ""}
                </span>
              </div>
            ))}
            {account.contacts.length === 0 ? <p className="muted">No contacts.</p> : null}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <h2>Opportunities ({account.deals.length})</h2>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th>Amount</th>
                <th>Stage</th>
              </tr>
            </thead>
            <tbody>
              {account.deals.map((d) => (
                <tr key={d.id}>
                  <td>
                    <Link href={`/deals/${d.id}`}>{d.name}</Link>
                  </td>
                  <td>{money(d.amount, d.currency)}</td>
                  <td>
                    {d.stage.label}
                    {d.stage.isWon ? " ✅" : d.stage.isLost ? " ❌" : ""}
                  </td>
                </tr>
              ))}
              {account.deals.length === 0 ? (
                <tr>
                  <td colSpan={3} className="muted">
                    No opportunities yet.
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
