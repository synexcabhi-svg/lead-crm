"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError, fieldErrors } from "@/lib/client";
import { Field } from "@/components/ui";
import { ColorSelect } from "@/components/ColorSelect";

interface Meta {
  stages: { key: string; label: string }[];
  owners: { id: string; name: string; color?: string }[];
  technicalMembers: { id: string; name: string; color?: string }[];
  accounts: { id: string; name: string }[];
}

export function NewDealClient({ meta }: { meta: Meta }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    accountId: meta.accounts[0]?.id ?? "",
    amount: "",
    stageKey: meta.stages[0]?.key ?? "",
    ownerId: "",
    technicalMemberId: "",
    expectedCloseDate: "",
    notes: "",
  });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setErrs({});
    setBusy(true);
    try {
      const res = await api<{ deal: { id: string } }>("/api/deals", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          accountId: form.accountId,
          amount: form.amount === "" ? undefined : Number(form.amount),
          stageKey: form.stageKey,
          ownerId: form.ownerId,
          technicalMemberId: form.technicalMemberId,
          expectedCloseDate: form.expectedCloseDate,
          notes: form.notes,
        }),
      });
      router.push(`/deals/${res.deal.id}`);
      router.refresh();
    } catch (e2) {
      if (e2 instanceof ApiClientError) {
        setErr(e2.message);
        setErrs(fieldErrors(e2.details));
      } else setErr("Failed to create opportunity");
      setBusy(false);
    }
  }

  if (meta.accounts.length === 0) {
    return <p className="muted">Create an account first (convert a lead, or add one under Accounts).</p>;
  }

  return (
    <form onSubmit={submit} noValidate>
      {err ? <p className="err">{err}</p> : null}
      <Field label="Opportunity name" error={errs.name}>
        <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} required />
      </Field>
      <Field label="Account" error={errs.accountId}>
        <select className="select" value={form.accountId} onChange={(e) => set("accountId", e.target.value)}>
          {meta.accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="row">
        <Field label="Amount (INR)" error={errs.amount}>
          <input
            className="input"
            inputMode="numeric"
            value={form.amount}
            onChange={(e) => set("amount", e.target.value.replace(/[^\d]/g, ""))}
          />
        </Field>
        <Field label="Stage">
          <select className="select" value={form.stageKey} onChange={(e) => set("stageKey", e.target.value)}>
            {meta.stages.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="row">
        <Field label="Owner">
          <ColorSelect
            value={form.ownerId}
            onChange={(v) => set("ownerId", v)}
            placeholder="Unassigned"
            options={meta.owners.map((o) => ({ value: o.id, label: o.name, color: o.color }))}
          />
        </Field>
        <Field label="Sales Team">
          <ColorSelect
            value={form.technicalMemberId}
            onChange={(v) => set("technicalMemberId", v)}
            placeholder="Unassigned"
            options={meta.technicalMembers.map((m) => ({ value: m.id, label: m.name, color: m.color }))}
          />
        </Field>
      </div>
      <Field label="Expected close date" error={errs.expectedCloseDate}>
        <input
          className="input"
          type="date"
          value={form.expectedCloseDate}
          onChange={(e) => set("expectedCloseDate", e.target.value)}
        />
      </Field>
      <Field label="Notes">
        <textarea className="textarea" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
      </Field>
      <button className="btn primary" disabled={busy}>
        {busy ? "Creating…" : "Create opportunity"}
      </button>
    </form>
  );
}
