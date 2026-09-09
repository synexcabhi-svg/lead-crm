"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError, fieldErrors } from "@/lib/client";
import { Field } from "@/components/ui";

export function ChangePasswordForm({ forced }: { forced: boolean }) {
  const router = useRouter();
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setErrs({});
    if (newPassword !== confirm) {
      setErrs({ confirm: "Passwords do not match" });
      return;
    }
    setBusy(true);
    try {
      await api("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: forced ? undefined : currentPassword,
          newPassword,
        }),
      });
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
        setErrs(fieldErrors(err.details));
      } else setError("Could not change password");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      {error ? <p className="err">{error}</p> : null}
      {!forced ? (
        <Field label="Current password" htmlFor="cur" error={errs.currentPassword}>
          <input
            id="cur"
            type="password"
            className="input"
            value={currentPassword}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            required
          />
        </Field>
      ) : null}
      <Field label="New password" htmlFor="new" error={errs.newPassword} hint="At least 8 characters">
        <input
          id="new"
          type="password"
          className="input"
          value={newPassword}
          onChange={(e) => setNew(e.target.value)}
          autoComplete="new-password"
          required
        />
      </Field>
      <Field label="Confirm new password" htmlFor="cfm" error={errs.confirm}>
        <input
          id="cfm"
          type="password"
          className="input"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          required
        />
      </Field>
      <button className="btn primary" style={{ width: "100%" }} disabled={busy}>
        {busy ? "Saving…" : "Save password"}
      </button>
    </form>
  );
}
