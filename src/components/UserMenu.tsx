"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";

export function UserMenu({
  name,
  email,
  role,
  color,
}: {
  name: string;
  email: string;
  role: string;
  color: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  async function signOut() {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="user-menu" ref={ref}>
      <button
        className="user-chip"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="who-dot" style={{ background: color }}>
          {initials}
        </span>
        <span className="user-chip-text">
          <b>{name}</b> <span className="muted">· {role}</span>
          <br />
          <span className="muted" style={{ fontSize: "0.75rem" }}>
            {email}
          </span>
        </span>
        <span aria-hidden style={{ marginLeft: 4 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open ? (
        <div className="user-pop" role="menu">
          <div className="user-pop-head">
            <b>{name}</b>
            <div className="muted" style={{ fontSize: "0.78rem" }}>
              {email}
            </div>
            <div className="muted" style={{ fontSize: "0.78rem" }}>
              {role}
            </div>
          </div>
          <a href="/change-password" className="user-pop-item">
            Change password
          </a>
          <button className="user-pop-item danger" onClick={signOut}>
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
