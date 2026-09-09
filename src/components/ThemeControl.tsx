"use client";

import { useEffect, useRef, useState } from "react";

const KEY = "crm_primary";
const PRESETS = [
  { name: "Blue", value: "#2563eb" },
  { name: "Indigo", value: "#4f46e5" },
  { name: "Violet", value: "#7c3aed" },
  { name: "Teal", value: "#0d9488" },
  { name: "Emerald", value: "#059669" },
  { name: "Amber", value: "#d97706" },
  { name: "Rose", value: "#e11d48" },
  { name: "Slate", value: "#475569" },
];

export function applyTheme(color: string | null) {
  const r = document.documentElement.style;
  const props = ["--primary", "--primary-hover", "--primary-weak", "--bg", "--surface"];
  if (!color) {
    props.forEach((p) => r.removeProperty(p));
    return;
  }
  r.setProperty("--primary", color);
  r.setProperty("--primary-hover", `color-mix(in srgb, ${color} 85%, black)`);
  r.setProperty("--primary-weak", `color-mix(in srgb, ${color} 15%, transparent)`);
  // tint the page + card backgrounds; text colours are left untouched
  r.setProperty("--bg", `color-mix(in srgb, ${color} 8%, #f5f6f8)`);
  r.setProperty("--surface", `color-mix(in srgb, ${color} 3%, #ffffff)`);
}

/** No-UI applier - mount once at the app root so the theme sticks everywhere. */
export function ThemeApplier() {
  useEffect(() => {
    try {
      applyTheme(localStorage.getItem(KEY));
    } catch {
      /* ignore */
    }
  }, []);
  return null;
}

/** The picker button + popover for the header. */
export function ThemeControl() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      setCurrent(localStorage.getItem(KEY));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function choose(value: string | null) {
    try {
      if (value) localStorage.setItem(KEY, value);
      else localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    applyTheme(value);
    setCurrent(value);
  }

  return (
    <div className="theme-wrap" ref={ref}>
      <button className="btn sm" onClick={() => setOpen((v) => !v)} title="Theme colour">
        <span
          aria-hidden
          style={{
            width: 12,
            height: 12,
            borderRadius: 3,
            background: current || "#2563eb",
            display: "inline-block",
          }}
        />
        Theme
      </button>
      {open ? (
        <div className="theme-pop">
          <div className="swatches">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                className={`swatch ${current === p.value ? "active" : ""}`}
                style={{ background: p.value }}
                title={p.name}
                onClick={() => choose(p.value)}
              />
            ))}
          </div>
          <label className="hint" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            Custom
            <input
              type="color"
              value={current || "#2563eb"}
              onChange={(e) => choose(e.target.value)}
              style={{ width: 40, height: 26, padding: 0, border: "1px solid var(--border)" }}
            />
          </label>
          <button className="btn sm" style={{ marginTop: 8, width: "100%" }} onClick={() => choose(null)}>
            Reset to default
          </button>
        </div>
      ) : null}
    </div>
  );
}
