"use client";

/**
 * ONE reusable lead form, used by:
 *   - admin "Add Lead"   (mode="create")
 *   - admin "Edit Lead"  (mode="edit")
 *   - public website form (mode="public")
 *
 * All three validate against the shared Zod schemas in domain/leads/lead.schema
 * before hitting the network, and the server re-validates with the same schemas.
 */
import { useEffect, useRef, useState } from "react";
import { api, ApiClientError, fieldErrors } from "@/lib/client";
import { leadAdminSchema, leadPublicSchema, leadUpdateSchema } from "@/domain/leads/lead.schema";
import { Field } from "@/components/ui";
import { ColorSelect } from "@/components/ColorSelect";
import { LEAD_PRIORITIES } from "@/domain/leads/lead.constants";

export interface LeadFormMeta {
  statuses: { key: string; label: string }[];
  sources: { key: string; label: string; color?: string }[];
  owners: { id: string; name: string; color?: string }[];
  technicalMembers: { id: string; name: string; color?: string }[];
  priorities?: readonly string[];
}

export interface LeadInitial {
  id?: string;
  firstName?: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  message?: string | null;
  notes?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  priority?: string;
  statusKey?: string;
  sourceKey?: string;
  ownerId?: string | null;
  technicalMemberId?: string | null;
}

type Mode = "create" | "edit" | "public";

export function LeadForm({
  mode,
  meta,
  initial,
  onSuccess,
}: {
  mode: Mode;
  meta?: LeadFormMeta;
  initial?: LeadInitial;
  onSuccess?: (result: { id?: string }) => void;
}) {
  const isPublic = mode === "public";
  const [form, setForm] = useState({
    firstName: initial?.firstName ?? "",
    lastName: initial?.lastName ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    company: initial?.company ?? "",
    message: initial?.message ?? "",
    notes: initial?.notes ?? "",
    city: initial?.city ?? "",
    state: initial?.state ?? "",
    country: initial?.country ?? "",
    postalCode: initial?.postalCode ?? "",
    priority: initial?.priority ?? "MEDIUM",
    statusKey: initial?.statusKey ?? "",
    sourceKey: initial?.sourceKey ?? "",
    ownerId: initial?.ownerId ?? "",
    technicalMemberId: initial?.technicalMemberId ?? "",
    consent: false,
    website: "", // honeypot
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [geoNote, setGeoNote] = useState<string | null>(null);
  const geoTried = useRef(false);

  // On the public form, try to pre-fill city/state/country from the visitor's
  // IP. Best-effort: silent on failure, and only fills fields the user left blank.
  useEffect(() => {
    if (!isPublic || geoTried.current) return;
    geoTried.current = true;
    api<{ geo: { city: string | null; state: string | null; country: string | null; postalCode: string | null } | null }>(
      "/api/public/geo",
    )
      .then((r) => {
        if (!r.geo) return;
        setForm((f) => ({
          ...f,
          city: f.city || r.geo!.city || "",
          state: f.state || r.geo!.state || "",
          country: f.country || r.geo!.country || "",
          postalCode: f.postalCode || r.geo!.postalCode || "",
        }));
        if (r.geo.city || r.geo.state) setGeoNote("We filled in your location from your connection — please correct it if it's wrong.");
      })
      .catch(() => {});
  }, [isPublic]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);

    const schema = isPublic ? leadPublicSchema : mode === "edit" ? leadUpdateSchema : leadAdminSchema;
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error.flatten()));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      if (isPublic) {
        await api("/api/public/leads", { method: "POST", body: JSON.stringify(parsed.data) });
        setDone(true);
      } else if (mode === "edit") {
        const res = await api<{ lead: { id: string } }>(`/api/leads/${initial!.id}`, {
          method: "PATCH",
          body: JSON.stringify(parsed.data),
        });
        onSuccess?.({ id: res.lead.id });
      } else {
        const res = await api<{ lead: { id: string } }>("/api/leads", {
          method: "POST",
          body: JSON.stringify(parsed.data),
        });
        onSuccess?.({ id: res.lead.id });
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        setServerError(err.message);
        const fe = fieldErrors(err.details);
        if (Object.keys(fe).length) setErrors(fe);
      } else {
        setServerError("Something went wrong. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (isPublic && done) {
    return (
      <div className="card" role="status">
        <h2>Thanks - we&apos;ve got your details.</h2>
        <p className="muted">Our team will be in touch shortly.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      {serverError ? (
        <div className="card" style={{ borderColor: "var(--danger)", marginBottom: 12 }}>
          <span className="err">{serverError}</span>
        </div>
      ) : null}

      <div className="row">
        <Field label="First name" htmlFor="firstName" error={errors.firstName}>
          <input id="firstName" className="input" value={form.firstName} onChange={set("firstName")} required />
        </Field>
        <Field label="Last name" htmlFor="lastName" error={errors.lastName}>
          <input id="lastName" className="input" value={form.lastName ?? ""} onChange={set("lastName")} />
        </Field>
      </div>

      <div className="row">
        <Field label="Email" htmlFor="email" error={errors.email} hint="Email or phone required">
          <input id="email" type="email" className="input" value={form.email ?? ""} onChange={set("email")} />
        </Field>
        <Field label="Phone" htmlFor="phone" error={errors.phone}>
          <input id="phone" className="input" value={form.phone ?? ""} onChange={set("phone")} />
        </Field>
      </div>

      <Field label="Company" htmlFor="company" error={errors.company}>
        <input id="company" className="input" value={form.company ?? ""} onChange={set("company")} />
      </Field>

      <div className="row">
        <Field label="City" htmlFor="city" error={errors.city}>
          <input id="city" className="input" value={form.city ?? ""} onChange={set("city")} />
        </Field>
        <Field label="State / Region" htmlFor="state" error={errors.state}>
          <input id="state" className="input" value={form.state ?? ""} onChange={set("state")} />
        </Field>
      </div>
      <div className="row">
        <Field label="Country" htmlFor="country" error={errors.country}>
          <input id="country" className="input" value={form.country ?? ""} onChange={set("country")} />
        </Field>
        <Field label="Postal code" htmlFor="postalCode" error={errors.postalCode}>
          <input id="postalCode" className="input" value={form.postalCode ?? ""} onChange={set("postalCode")} />
        </Field>
      </div>
      {isPublic && geoNote ? <p className="hint" style={{ marginTop: -4 }}>{geoNote}</p> : null}

      <Field label={isPublic ? "How can we help?" : "Message"} htmlFor="message" error={errors.message}>
        <textarea id="message" className="textarea" value={form.message ?? ""} onChange={set("message")} />
      </Field>

      {!isPublic && meta ? (
        <>
          <Field label="Internal notes" htmlFor="notes" error={errors.notes}>
            <textarea id="notes" className="textarea" value={form.notes ?? ""} onChange={set("notes")} />
          </Field>
          <div className="row">
            <Field label="Status" htmlFor="statusKey">
              <select id="statusKey" className="select" value={form.statusKey} onChange={set("statusKey")}>
                <option value="">Default (New)</option>
                {meta.statuses.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Priority" htmlFor="priority">
              <select id="priority" className="select" value={form.priority} onChange={set("priority")}>
                {(meta.priorities ?? LEAD_PRIORITIES).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="row">
            <Field label="Source" htmlFor="sourceKey">
              <ColorSelect
                value={form.sourceKey}
                onChange={(v) => setForm((f) => ({ ...f, sourceKey: v }))}
                placeholder={mode === "edit" ? "(unchanged)" : "Manual entry"}
                options={meta.sources.map((s) => ({ value: s.key, label: s.label, color: s.color }))}
              />
            </Field>
            <Field label="Owner" htmlFor="ownerId">
              <ColorSelect
                value={form.ownerId ?? ""}
                onChange={(v) => setForm((f) => ({ ...f, ownerId: v }))}
                placeholder="Unassigned"
                options={meta.owners.map((o) => ({ value: o.id, label: o.name, color: o.color }))}
              />
            </Field>
          </div>
          <Field
            label="Sales Team"
            htmlFor="technicalMemberId"
            hint="Sales Team member who handles this lead once assigned"
          >
            <ColorSelect
              value={form.technicalMemberId ?? ""}
              onChange={(v) => setForm((f) => ({ ...f, technicalMemberId: v }))}
              placeholder="Unassigned"
              options={meta.technicalMembers.map((m) => ({ value: m.id, label: m.name, color: m.color }))}
            />
          </Field>
        </>
      ) : null}

      {isPublic ? (
        <>
          {/* honeypot - visually hidden, not tab-focusable */}
          <div style={{ position: "absolute", left: "-9999px" }} aria-hidden>
            <label>
              Website
              <input tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} />
            </label>
          </div>
          <label style={{ display: "flex", gap: 8, alignItems: "flex-start", margin: "8px 0 14px" }}>
            <input type="checkbox" checked={form.consent} onChange={set("consent")} />
            <span className="hint">I agree to be contacted about my enquiry.</span>
          </label>
        </>
      ) : null}

      <button className="btn primary" type="submit" disabled={busy}>
        {busy ? "Saving..." : mode === "edit" ? "Save changes" : mode === "public" ? "Submit" : "Create lead"}
      </button>
    </form>
  );
}
