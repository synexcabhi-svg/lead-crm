"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const POLL_MS = Number(process.env.NEXT_PUBLIC_DASHBOARD_POLL_MS || 30000);

type Status = "live" | "polling" | "connecting";

/**
 * Keeps dashboard data fresh with three layers of defence:
 *   1. SSE stream (/api/events) - instant push on any lead.* change
 *   2. interval polling - fallback when SSE is unavailable / dropped
 *   3. refetch on tab focus / visibility
 * plus a manual `refresh()` the caller invokes right after its own mutations.
 */
export function useRealtime(onChange: () => void): { status: Status; refresh: () => void } {
  const [status, setStatus] = useState<Status>("connecting");
  const cb = useRef(onChange);
  cb.current = onChange;

  const refresh = useCallback(() => cb.current(), []);

  useEffect(() => {
    let es: EventSource | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    let stopped = false;

    const startPolling = () => {
      if (poll) return;
      setStatus((s) => (s === "live" ? s : "polling"));
      poll = setInterval(() => cb.current(), POLL_MS);
    };
    const stopPolling = () => {
      if (poll) clearInterval(poll);
      poll = null;
    };

    const connect = () => {
      try {
        es = new EventSource("/api/events");
      } catch {
        startPolling();
        return;
      }
      es.onopen = () => {
        if (stopped) return;
        setStatus("live");
        stopPolling(); // SSE is enough while it's up
      };
      es.onmessage = (e) => {
        if (stopped) return;
        try {
          const data = JSON.parse(e.data) as { type?: string };
          if (data.type && data.type.startsWith("lead.")) cb.current();
        } catch {
          /* ignore keepalives */
        }
      };
      es.onerror = () => {
        setStatus("polling");
        startPolling(); // keep data flowing while EventSource auto-reconnects
      };
    };

    connect();
    // safety-net poll even if SSE seems fine, at a slow cadence handled above
    const onVisible = () => {
      if (document.visibilityState === "visible") cb.current();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      stopped = true;
      es?.close();
      stopPolling();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  return { status, refresh };
}
