"use client";

/**
 * Lead -> Deal conversion panel, shown on the lead detail page.
 *   - lead already converted  -> links to the Account / Contact / Deal
 *   - lead in a "converted" status -> the conversion form
 *   - otherwise -> a hint to move the lead to a converted status first
 */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiClientError, fieldErrors } from "@/lib/client";
import { Field } from "@/components/ui";
import { money } from "@/lib/format";

export interface ConvertMeta {
  dealStages: { key: string; label: string }[];
  accounts: { id: string; name: string }[];
  owners: { id: string; name: string }[];
}

interface LeadForConvert {
  id: string;
  firstName: string;
  lastName: string | null;
  company: string | null;
  ownerId: string | null;
  convertedAt: string | null;
  status: { label: string; isConverted?: boolean };
  convertedAccount: { id: string; name: string } | null;
  convertedContact: { id: string; firstName: string; lastName: string | null } | null;
  convertedDeal: { id: string; name: string; amount: number | null; currency: string } | null;
}

export function ConvertLeadPanel({ lead, meta }: { lead: LeadForConvert; meta: ConvertMeta }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});

  const personName = `${lead.firstName} ${lead.lastName ?? ""}`.trim();
  const defaultAccountName = (lead.company ?? "").trim() || personName;

  const [form, setForm] = useState({
    accountMode: "new" as "new" | "existing",
    accountName: defaultAccountName,
    accountId: "",
    createDeal: true,
    dealName: `${defaultAccountName} - ${lead.firstName}`,
    amount: "",
    stageKey: meta.dealStages[0]?.key ?? "",
    expectedCloseDate: "",
    ownerId: lead.ownerId ?? "",
  });
  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  // ---- already converted -------------------------------------------------
  if (lead.convertedAt) {
    return (
      <div className="card" style={{ borderColor: "var(--success)" }}>
        <h2>Converted</h2>
        <p className="muted" style={{ marginTop: -4 }}>
          {new Date(lead.convertedAt).toLocaleString()}
        </p>
        <dl style={{ display: "grid", gridTemplateColumns: "90px 1fr", rowGap: 6, margin: 0 }}>
          <dt className="muted">Account</dt>
          <dd style={{ margin: 0 }}>
            {lead.convertedAccount ? (
              <Link href={`/accounts/${lead.convertedAccount.id}`}>{lead.convertedAccount.name}</Link>
            ) : (
              "—"
            )}
          </dd>
          <dt className="muted">Contact</dt>
          <dd style={{ margin: 0 }}>
            {lead.convertedContact
              ? `${lead.convertedContact.firstName} ${lead.convertedContact.lastName ?? ""}`.trim()
              : "—"}
          </dd>
          <dt className="muted">Deal</dt>
          <dd style={{ margin: 0 }}>
            {lead.convertedDeal ? (
              <Link href={`/deals/${lead.convertedDeal.id}`}>
                {lead.convertedDeal.name} · {money(lead.convertedDeal.amount, lead.convertedDeal.currency)}
              </Link>
            ) : (
              "no deal created"
            )}
          </dd>
        </dl>
      </div>
    );
  }

  // ---- not in a converted status --------------------------------------
  if (!lead.status.isConverted) {
    return (
      <div className="card">
        <h2>Convert to deal</h2>
        <p className="muted">
          Set this lead&apos;s status to a <b>converted</b> status (e.g. &quot;Converted&quot;) to
          turn it into an account &amp; deal.
        </p>
      </div>
    );
  }

  // ---- convertible ---------------------------------------------------
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setErrs({});
    setBusy(true);
    try {
      const body = {
        accountId: form.accountMode === "existing" ? form.accountId : "",
        accountName: form.accountMode === "new" ? form.accountName : "",
        createDeal: form.createDeal,
        dealName: form.dealName,
        amount: form.amount === "" ? undefined : Number(form.amount),
        stageKey: form.stageKey,
        expectedCloseDate: form.expectedCloseDate,
        ownerId: form.ownerId,
      };
      const res = await api<{ deal: { id: string } | null }>(`/api/leads/${lead.id}/convert`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (res.deal?.id) router.push(`/deals/${res.deal.id}`);
      else router.refresh();
    } catch (e2) {
      if (e2 instanceof ApiClientError) {
        setErr(e2.message);
        setErrs(fieldErrors(e2.details));
      } else setErr("Conversion failed");
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ borderColor: "var(--primary)" }}>
      <h2>Convert to deal</h2>
      {!open ? (
        <>
          <p className="muted">
            Create an Account, a Contact and (optionally) a Deal from this lead.
          </p>
          <button className="btn primary" onClick={() => setOpen(true)}>
            Convert this lead
          </button>
        </>
      ) : (
        <form onSubmit={submit} noValidate>
          {err ? <p className="err">{err}</p> : null}

          <Field label="Account" error={errs.accountId || errs.accountName}>
            <div className="stack" style={{ gap: 8 }}>
              <label className="hint" style={{ display: "flex", gap: 6 }}>
                <input
                  type="radio"
                  checked={form.accountMode === "new"}
                  onChange={() => set("accountMode", "new")}
                />
                Create new account
              </label>
              {form.accountMode === "new" ? (
                <input
                  className="input"
                  value={form.accountName}
                  onChange={(e) => set("accountName", e.target.value)}
                  placeholder="Account name"
                />
              ) : null}
              <label className="hint" style={{ display: "flex", gap: 6 }}>
                <input
                  type="radio"
                  checked={form.accountMode === "existing"}
                  onChange={() => set("accountMode", "existing")}
                />
                Use existing account
              </label>
              {form.accountMode === "existing" ? (
                <select
                  className="select"
                  value={form.accountId}
                  onChange={(e) => set("accountId", e.target.value)}
                >
                  <option value="">Select an account…</option>
                  {meta.accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
          </Field>

          <label style={{ display: "flex", gap: 8, alignItems: "center", margin: "6px 0 12px" }}>
            <input
              type="checkbox"
              checked={form.createDeal}
              onChange={(e) => set("createDeal", e.target.checked)}
            />
            <span>Also create a deal</span>
          </label>

          {form.createDeal ? (
            <>
              <Field label="Deal name" error={errs.dealName}>
                <input
                  className="input"
                  value={form.dealName}
                  onChange={(e) => set("dealName", e.target.value)}
                />
              </Field>
              <div className="row">
                <Field label="Amount (INR)" error={errs.amount}>
                  <input
                    className="input"
                    inputMode="numeric"
                    value={form.amount}
                    onChange={(e) => set("amount", e.target.value.replace(/[^\d]/g, ""))}
                    placeholder="e.g. 250000"
                  />
                </Field>
                <Field label="Stage">
                  <select
                    className="select"
                    value={form.stageKey}
                    onChange={(e) => set("stageKey", e.target.value)}
                  >
                    {meta.dealStages.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="row">
                <Field label="Expected close date" error={errs.expectedCloseDate}>
                  <input
                    className="input"
                    type="date"
                    value={form.expectedCloseDate}
                    onChange={(e) => set("expectedCloseDate", e.target.value)}
                  />
                </Field>
                <Field label="Owner">
                  <select
                    className="select"
                    value={form.ownerId}
                    onChange={(e) => set("ownerId", e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {meta.owners.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </>
          ) : null}

          <div className="row" style={{ flex: "unset", gap: 8 }}>
            <button className="btn primary" disabled={busy}>
              {busy ? "Converting…" : "Convert"}
            </button>
            <button type="button" className="btn" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
