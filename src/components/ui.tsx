"use client";

import { useEffect } from "react";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && !error ? <span className="hint">{hint}</span> : null}
      {error ? <span className="err">{error}</span> : null}
    </div>
  );
}

export function Toast({
  message,
  kind = "info",
  onDone,
}: {
  message: string;
  kind?: "info" | "error";
  onDone: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDone, kind === "error" ? 5000 : 3000);
    return () => clearTimeout(t);
  }, [message, kind, onDone]);
  return <div className={`toast ${kind === "error" ? "error" : ""}`}>{message}</div>;
}

export function Spinner({ label = "Loading..." }: { label?: string }) {
  return <p className="muted">{label}</p>;
}
